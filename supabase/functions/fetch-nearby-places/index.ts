/**
 * Triggered via DB Webhook on UPDATE of pings WHERE status = 'voting'.
 *
 * 1. Reads "in" RSVPs with location for the ping.
 * 2. Computes the barycenter of member locations.
 * 3. Looks up restaurants/bars within SEARCH_RADIUS_M from OpenStreetMap
 *    (Overpass, falling back to Nominatim; see _shared/osm.ts).
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
 * wider result limit and inserting only places not already present
 * (deduped by external_id / proximity).
 */
import { createServiceClient } from '../_shared/supabase-client.ts';
import { forbidden, isServiceCall } from '../_shared/auth.ts';
import { findVenues, type LatLng } from '../_shared/osm.ts';

const SEARCH_RADIUS_M = 400;
const MAX_PLACES = 8;
// Buffer above MAX_PLACES since some raw elements get filtered out below
// (missing name/coords) — but still capped well short of "every match",
// which in dense areas can be 300+ elements Overpass has to compute and
// serialize before returning anything.
const OVERPASS_RESULT_LIMIT = 30;

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
  if (!(await isServiceCall(req))) return forbidden();

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

    // ── OpenStreetMap: Overpass, falling back to Nominatim ───────────────
    // Each batch widens the result window, so "Find more places" has a real
    // pool of not-yet-seen venues to dedupe against.
    const { source, candidates } = await findVenues(barycenter, SEARCH_RADIUS_M, OVERPASS_RESULT_LIMIT * placesBatch);
    const fresh = candidates
      .filter((c) => !existingExternalIds.has(c.externalId))
      .sort((x, y) => haversineMeters(barycenter, x) - haversineMeters(barycenter, y))
      .slice(0, MAX_PLACES);
    console.log(`Venues from ${source}: ${candidates.length} found, ${fresh.length} new`);

    for (const c of fresh) {
      placesToInsert.push({
        ping_id: pingId,
        name: c.name,
        address: c.address,
        latitude: c.latitude,
        longitude: c.longitude,
        category: c.category,
        source: 'osm',
        external_id: c.externalId,
        photo_url: null,
        rating: null,
        suggested_by: null,
        batch: placesBatch,
      });
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
