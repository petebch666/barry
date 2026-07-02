/**
 * Triggered via DB Webhook on UPDATE of rsvps.
 *
 * When an 'in' RSVP changes to 'out'/'maybe':
 * 1. Recomputes the barycenter without the departing member.
 * 2. If the shift exceeds 1 km, notifies remaining 'in' members.
 * 3. If the ping is in 'voting' state, inserts additional OSM places at
 *    the new barycenter (deduplicated against existing ones by external_id).
 */
import { createServiceClient } from '../_shared/supabase-client.ts';

const SHIFT_THRESHOLD_M = 1_000;
const SEARCH_RADIUS_M = 800;
const MAX_NEW_PLACES = 4;
const OVERPASS_RESULT_LIMIT = 15;
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OVERPASS_TIMEOUT_MS = 15_000;
const RETRY_BACKOFF_MS = 1_500;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

// Bounds the Overpass call so a slow/rate-limited response can't eat the
// function's whole wall-clock budget — see the same guard in
// fetch-nearby-places/index.ts for the production incident that motivated this.
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// One retry after a short backoff for transient failures (timeout/network
// error, or a 429/502/503/504) — see fetch-nearby-places/index.ts for the
// same pattern and the production incident that motivated it.
async function fetchOverpassWithRetry(url: string, options: RequestInit): Promise<Response> {
  try {
    const res = await fetchWithTimeout(url, options, OVERPASS_TIMEOUT_MS);
    if (res.ok || !RETRYABLE_STATUSES.has(res.status)) return res;
    console.warn(`Overpass mirror ${url} returned ${res.status}, retrying once`);
  } catch (err) {
    console.warn(`Overpass mirror ${url} failed or timed out, retrying once:`, err);
  }
  await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
  return await fetchWithTimeout(url, options, OVERPASS_TIMEOUT_MS);
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
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

Deno.serve(async (req) => {
  try {
    const { record, old_record } = await req.json();

    // Only act when someone switches away from 'in'
    if (old_record?.status !== 'in' || record.status === 'in') {
      return Response.json({ skipped: true });
    }

    const supabase = createServiceClient();

    // Fetch the ping to check its current state
    const { data: ping } = await supabase
      .from('pings')
      .select('id, message, status, created_by')
      .eq('id', record.ping_id)
      .single();

    if (!ping || ping.status === 'confirmed' || ping.status === 'cancelled') {
      return Response.json({ skipped: 'ping_terminal' });
    }

    // Remaining 'in' RSVPs with location (the departing member is already excluded
    // because their row now has status 'out'/'maybe')
    const { data: remaining } = await supabase
      .from('rsvps')
      .select('user_id, latitude, longitude')
      .eq('ping_id', record.ping_id)
      .eq('status', 'in')
      .not('latitude', 'is', null);

    const newBarycenter = computeBarycenter(
      (remaining ?? []).map((r: { latitude: number; longitude: number }) => ({
        latitude: r.latitude,
        longitude: r.longitude,
      })),
    );

    if (!newBarycenter) return Response.json({ skipped: 'no_remaining_location_data' });

    // Old barycenter = remaining + the departing member (if they had location)
    const leaverLoc = old_record.latitude && old_record.longitude
      ? { latitude: old_record.latitude as number, longitude: old_record.longitude as number }
      : null;

    const oldPoints: LatLng[] = [
      ...(remaining ?? []).map((r: { latitude: number; longitude: number }) => ({
        latitude: r.latitude,
        longitude: r.longitude,
      })),
      ...(leaverLoc ? [leaverLoc] : []),
    ];
    const oldBarycenter = computeBarycenter(oldPoints);

    if (!oldBarycenter) return Response.json({ skipped: 'no_old_barycenter' });

    const shiftM = haversineMeters(oldBarycenter, newBarycenter);
    if (shiftM < SHIFT_THRESHOLD_M) {
      return Response.json({ skipped: 'shift_below_threshold', shiftM: Math.round(shiftM) });
    }

    // ── Notify remaining 'in' members ────────────────────────────────────
    const remainingUserIds = (remaining ?? []).map((r: { user_id: string }) => r.user_id);
    const { data: tokenRows } = await supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', remainingUserIds);

    const tokens = (tokenRows ?? []).map((t: { token: string }) => t.token);

    const shiftKm = (Math.round(shiftM / 100) / 10).toFixed(1);
    const notifBody = ping.status === 'voting'
      ? `Meeting point shifted ${shiftKm} km — new places added.`
      : `Meeting point shifted ${shiftKm} km closer — you may want to pick a new spot.`;

    if (tokens.length) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          tokens,
          title: 'Meeting point shifted',
          body: notifBody,
          data: { pingId: ping.id, type: 'barycenter_shift' },
        }),
      });
    }

    // ── Add new OSM places at the new barycenter (voting state only) ──────
    let inserted = 0;
    if (ping.status === 'voting') {
      try {
        const query = [
          '[out:json][timeout:10];',
          '(',
          `  node["amenity"~"^(restaurant|bar)$"](around:${SEARCH_RADIUS_M},${newBarycenter.latitude},${newBarycenter.longitude});`,
          `  way["amenity"~"^(restaurant|bar)$"](around:${SEARCH_RADIUS_M},${newBarycenter.latitude},${newBarycenter.longitude});`,
          ');',
          `out body center ${OVERPASS_RESULT_LIMIT};`,
        ].join('\n');

        const res = await fetchOverpassWithRetry(OVERPASS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'BarryApp/1.0',
          },
          body: `data=${encodeURIComponent(query)}`,
        });

        if (res.ok) {
          const { elements = [] } = await res.json() as { elements: OsmElement[] };

          // Deduplicate against places already in this ping
          const { data: existing } = await supabase
            .from('places')
            .select('external_id')
            .eq('ping_id', ping.id);

          const existingIds = new Set(
            (existing ?? []).map((p: { external_id: string | null }) => p.external_id).filter(Boolean),
          );

          const newPlaces: Record<string, unknown>[] = [];

          for (const element of elements) {
            if (newPlaces.length >= MAX_NEW_PLACES) break;

            const lat = element.type === 'node' ? element.lat : element.center?.lat;
            const lon = element.type === 'node' ? element.lon : element.center?.lon;
            const tags = element.tags ?? {};
            if (!lat || !lon || !tags.name) continue;

            const extId = `${element.type}/${element.id}`;
            if (existingIds.has(extId)) continue;

            const addrParts: string[] = [];
            if (tags['addr:housenumber'] && tags['addr:street']) {
              addrParts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
            } else if (tags['addr:street']) {
              addrParts.push(tags['addr:street']);
            }
            if (tags['addr:city']) addrParts.push(tags['addr:city']);

            newPlaces.push({
              ping_id: ping.id,
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
            });
          }

          if (newPlaces.length) {
            const { error } = await supabase.from('places').insert(newPlaces);
            if (!error) inserted = newPlaces.length;
          }
        }
      } catch (overpassErr) {
        console.error('Overpass error in notify-rsvp-change:', overpassErr);
      }
    }

    return Response.json({ notified: tokens.length, shiftM: Math.round(shiftM), newPlacesInserted: inserted });
  } catch (err) {
    console.error('notify-rsvp-change error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
