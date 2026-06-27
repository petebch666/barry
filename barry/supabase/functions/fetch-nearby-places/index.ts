/**
 * Triggered via DB Webhook on UPDATE of pings WHERE status = 'voting'.
 *
 * 1. Reads "in" RSVPs with location for the ping.
 * 2. Computes the barycenter.
 * 3. Calls Google Places Nearby Search API.
 * 4. Merges participants' saved_places within 800 m.
 * 5. Inserts results into the places table.
 *
 * The client subscribes to the places Realtime channel and renders cards as
 * they arrive — no polling required.
 */
import { createServiceClient } from '../_shared/supabase-client.ts';

const SEARCH_RADIUS_M = 800;
const MAX_PLACES = 8;

interface LatLng { latitude: number; longitude: number; }

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
    const { id: pingId, group_id, status } = record as {
      id: string; group_id: string; status: string;
    };

    // Only process when transitioning to voting
    if (status !== 'voting') return Response.json({ skipped: true });

    const supabase = createServiceClient();

    // Guard: skip if places already exist (idempotency)
    const { count } = await supabase
      .from('places')
      .select('id', { count: 'exact', head: true })
      .eq('ping_id', pingId);
    if ((count ?? 0) > 0) return Response.json({ skipped: 'already_fetched' });

    // Get "in" RSVPs with location
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

    // Without location data we cannot suggest places — exit gracefully
    if (!barycenter) return Response.json({ skipped: 'no_location_data' });

    const placesToInsert: Record<string, unknown>[] = [];

    // ── Google Places Nearby Search ───────────────────────────────────────
    const googleKey = Deno.env.get('GOOGLE_PLACES_KEY');
    if (googleKey) {
      const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
      url.searchParams.set('location', `${barycenter.latitude},${barycenter.longitude}`);
      url.searchParams.set('radius', String(SEARCH_RADIUS_M));
      url.searchParams.set('type', 'bar|restaurant');
      url.searchParams.set('key', googleKey);

      const res = await fetch(url.toString());
      const { results = [] } = await res.json();

      for (const place of results.slice(0, MAX_PLACES)) {
        placesToInsert.push({
          ping_id: pingId,
          name: place.name,
          address: place.vicinity ?? null,
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          category: place.types?.[0] ?? null,
          source: 'google_places',
          external_id: place.place_id,
          photo_url: place.photos?.[0]
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${googleKey}`
            : null,
          rating: place.rating ?? null,
          suggested_by: null,
        });
      }
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
        if (dist > SEARCH_RADIUS_M * 2) continue; // allow 2× radius for personal favourites

        const alreadyIn = placesToInsert.some((p) =>
          haversineMeters(
            { latitude: p.latitude as number, longitude: p.longitude as number },
            { latitude: sp.latitude, longitude: sp.longitude },
          ) < 50, // deduplicate if within 50 m of a Google result
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
            external_id: sp.google_place_id ?? null,
            photo_url: null,
            rating: null,
            suggested_by: sp.user_id,
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
