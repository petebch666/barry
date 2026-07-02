/**
 * Triggered via DB Webhook on UPDATE of pings WHERE status = 'voting'.
 *
 * 1. Reads "in" RSVPs with location for the ping.
 * 2. Computes the barycenter of member locations.
 * 3. Queries Overpass API (OpenStreetMap) for restaurants/bars within
 *    SEARCH_RADIUS_M.
 * 4. Merges participants' saved_places within SEARCH_RADIUS_M.
 * 5. Inserts results into the places table.
 *
 * The client subscribes to the places Realtime channel and renders cards as
 * they arrive — no polling required.
 *
 * Batches: pings.places_batch starts at 1 and is bumped by the
 * request_more_places() RPC when the group wants another round of
 * suggestions. Since this webhook fires on any UPDATE of pings (not just
 * the initial 'open'→'voting' transition), this function tracks the
 * highest places.batch already inserted for the ping and skips re-fetching
 * unless places_batch has actually advanced past that — re-querying with a
 * wider Overpass result limit and inserting only places not already present
 * (deduped by external_id / proximity).
 */
import { createServiceClient } from '../_shared/supabase-client.ts';

const SEARCH_RADIUS_M = 400;
const MAX_PLACES = 8;
// Buffer above MAX_PLACES since some raw elements get filtered out below
// (missing name/coords) — but still capped well short of "every match",
// which in dense areas can be 300+ elements Overpass has to compute and
// serialize before returning anything.
const OVERPASS_RESULT_LIMIT = 30;
const MIRROR_TIMEOUT_MS = 15_000;
const RETRY_BACKOFF_MS = 1_500;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// Bounds each mirror attempt so a slow/rate-limited mirror (e.g. a 429 that
// takes a couple of minutes to arrive) can't eat the function's whole
// wall-clock budget and starve the fallback mirrors — observed in
// production: overpass-api.de returned 429 after ~2m20s, and the function
// was killed by the platform before it could try the next mirror.
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// One retry per mirror after a short backoff, for transient failures only
// (timeout/network error, or a 429/502/503/504 — these commonly clear up a
// couple seconds later on Overpass's shared public instances). Worst case
// per mirror: MIRROR_TIMEOUT_MS*2 + RETRY_BACKOFF_MS.
async function fetchOverpassMirror(url: string, options: RequestInit): Promise<Response> {
  try {
    const res = await fetchWithTimeout(url, options, MIRROR_TIMEOUT_MS);
    if (res.ok || !RETRYABLE_STATUSES.has(res.status)) return res;
    console.warn(`Overpass mirror ${url} returned ${res.status}, retrying once`);
  } catch (err) {
    console.warn(`Overpass mirror ${url} failed or timed out, retrying once:`, err);
  }
  await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
  return await fetchWithTimeout(url, options, MIRROR_TIMEOUT_MS);
}

interface LatLng { latitude: number; longitude: number; }
interface OsmElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function computeBarycenter(points: LatLng[]): LatLng | null {
  if (!points.length) return null;
  let latSum = 0, lngSum = 0;
  for (const p of points) { latSum += p.latitude; lngSum += p.longitude; }
  return { latitude: latSum / points.length, longitude: lngSum / points.length };
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.latitude))*Math.cos(toRad(b.latitude))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
}

Deno.serve(async (req) => {
  try {
    const { record } = await req.json();
    const { id: pingId, status, places_batch: placesBatch } = record as {
      id: string; group_id: string; status: string; places_batch: number;
    };

    if (status !== 'voting') return Response.json({ skipped: true });

    const supabase = createServiceClient();

    // Batch-aware idempotency guard: skip only if we've already fetched up
    // to (or past) the ping's current places_batch — lets a places_batch
    // bump re-trigger a fetch, while ignoring unrelated re-deliveries of
    // this same webhook for the same batch.
    const { data: existingPlaces } = await supabase
      .from('places')
      .select('external_id, latitude, longitude, batch')
      .eq('ping_id', pingId);

    const maxExistingBatch = (existingPlaces ?? []).reduce((max, p) => Math.max(max, p.batch ?? 1), 0);
    if (maxExistingBatch >= placesBatch) return Response.json({ skipped: 'already_fetched_this_batch' });

    const existingExternalIds = new Set(
      (existingPlaces ?? []).map((p: { external_id: string | null }) => p.external_id).filter(Boolean),
    );
    const existingPoints: LatLng[] = (existingPlaces ?? []).map(
      (p: { latitude: number; longitude: number }) => ({ latitude: p.latitude, longitude: p.longitude }),
    );

    const { data: rsvps } = await supabase
      .from('rsvps')
      .select('user_id, latitude, longitude')
      .eq('ping_id', pingId)
      .eq('status', 'in')
      .not('latitude', 'is', null);

    const barycenter = computeBarycenter(
      (rsvps ?? []).map((r: { latitude: number; longitude: number }) => ({
        latitude: r.latitude,
        longitude: r.longitude,
      })),
    );

    if (!barycenter) return Response.json({ skipped: 'no_location_data' });

    const placesToInsert: Record<string, unknown>[] = [];

    // ── OpenStreetMap via Overpass API (free, no key required) ───────────
    try {
      // Widen the result window per batch so there's a real pool of
      // not-yet-seen elements to dedup against (Overpass returns nearest-
      // first, so batch 2 needs to look further out than batch 1 did).
      const overpassLimit = OVERPASS_RESULT_LIMIT * placesBatch;
      const query = [
        '[out:json][timeout:25];',
        '(',
        `  node["amenity"~"^(restaurant|bar)$"](around:${SEARCH_RADIUS_M},${barycenter.latitude},${barycenter.longitude});`,
        `  way["amenity"~"^(restaurant|bar)$"](around:${SEARCH_RADIUS_M},${barycenter.latitude},${barycenter.longitude});`,
        ');',
        `out body center ${overpassLimit};`,
      ].join('\n');

      const body = `data=${encodeURIComponent(query)}`;
      const fetchHeaders = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'BarryApp/1.0 (social meetup app)',
      };

      let res: Response | null = null;
      for (const mirror of OVERPASS_MIRRORS) {
        try {
          res = await fetchOverpassMirror(mirror, { method: 'POST', headers: fetchHeaders, body });
          if (res.ok) break;
          console.warn(`Overpass mirror ${mirror} returned ${res.status} (after retry)`);
        } catch (mirrorErr) {
          console.warn(`Overpass mirror ${mirror} failed or timed out (after retry):`, mirrorErr);
        }
      }

      if (res?.ok) {
        const { elements = [] } = await res.json() as { elements: OsmElement[] };
        console.log(`Overpass returned ${elements.length} elements near ${barycenter.latitude},${barycenter.longitude}`);

        let newOsmCount = 0;
        for (const element of elements) {
          if (newOsmCount >= MAX_PLACES) break;

          const lat = element.type === 'node' ? element.lat : element.center?.lat;
          const lon = element.type === 'node' ? element.lon : element.center?.lon;
          const tags = element.tags ?? {};
          if (!lat || !lon || !tags.name) continue;

          const extId = `${element.type}/${element.id}`;
          if (existingExternalIds.has(extId)) continue;

          const addrParts: string[] = [];
          if (tags['addr:housenumber'] && tags['addr:street']) {
            addrParts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
          } else if (tags['addr:street']) {
            addrParts.push(tags['addr:street']);
          }
          if (tags['addr:city']) addrParts.push(tags['addr:city']);

          placesToInsert.push({
            ping_id: pingId,
            name: tags.name,
            address: addrParts.join(', ') || null,
            latitude: lat,
            longitude: lon,
            category: tags.amenity ?? null,
            source: 'osm',
            external_id: extId,
            photo_url: null,
            rating: null,
            suggested_by: null,
            batch: placesBatch,
          });
          newOsmCount++;
        }
      }
    } catch (overpassErr) {
      console.error('Overpass API error:', overpassErr);
      // Continue — saved_places are still merged below
    }

    // ── Merge participants' saved_places within radius ────────────────────
    if (rsvps?.length) {
      const userIds = rsvps.map((r: { user_id: string }) => r.user_id);
      const { data: saved } = await supabase
        .from('saved_places')
        .select('*')
        .in('user_id', userIds);

      for (const sp of saved ?? []) {
        const dist = haversineMeters(barycenter, { latitude: sp.latitude, longitude: sp.longitude });
        if (dist > SEARCH_RADIUS_M * 2) continue;

        const nearbyPoints = [
          ...placesToInsert.map((p) => ({ latitude: p.latitude as number, longitude: p.longitude as number })),
          ...existingPoints,
        ];
        const alreadyIn = nearbyPoints.some(
          (p) => haversineMeters(p, { latitude: sp.latitude, longitude: sp.longitude }) < 50,
        );
        if (!alreadyIn) {
          placesToInsert.push({
            ping_id: pingId,
            name: sp.name,
            address: sp.address ?? null,
            latitude: sp.latitude,
            longitude: sp.longitude,
            category: sp.category ?? null,
            source: 'manual',
            external_id: sp.osm_id ?? null,
            photo_url: null,
            rating: null,
            suggested_by: sp.user_id,
            batch: placesBatch,
          });
        }
      }
    }

    if (placesToInsert.length) {
      const { error } = await supabase.from('places').insert(placesToInsert);
      if (error) throw error;
    }

    return Response.json({ inserted: placesToInsert.length });
  } catch (err) {
    console.error('fetch-nearby-places error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
