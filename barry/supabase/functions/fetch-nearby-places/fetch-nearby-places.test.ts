/**
 * Unit tests for fetch-nearby-places business logic.
 * Run with: deno test supabase/functions/fetch-nearby-places/fetch-nearby-places.test.ts
 */
import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// ─── Extracted pure functions ─────────────────────────────────────────────────

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

interface SavedPlace { latitude: number; longitude: number; name: string; user_id: string; }
interface GooglePlace { latitude: number; longitude: number; }

function mergeSavedPlaces(
  googlePlaces: GooglePlace[],
  savedPlaces: SavedPlace[],
  barycenter: LatLng,
  searchRadius: number,
  dedupeThresholdM = 50,
): SavedPlace[] {
  return savedPlaces.filter((sp) => {
    const distFromCenter = haversineMeters(barycenter, sp);
    if (distFromCenter > searchRadius * 2) return false;
    const tooClose = googlePlaces.some(
      (gp) => haversineMeters(gp, sp) < dedupeThresholdM,
    );
    return !tooClose;
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

Deno.test('barycenter — three members average correctly', () => {
  const center = computeBarycenter([
    { latitude: 48.860, longitude: 2.340 },
    { latitude: 48.870, longitude: 2.360 },
    { latitude: 48.850, longitude: 2.350 },
  ]);
  assertExists(center);
  assertEquals(center.latitude.toFixed(4), '48.8600');
  assertEquals(center.longitude.toFixed(4), '2.3500');
});

Deno.test('barycenter — single member returns that point', () => {
  const pt = { latitude: 48.86, longitude: 2.35 };
  const center = computeBarycenter([pt]);
  assertExists(center);
  assertEquals(center.latitude, pt.latitude);
  assertEquals(center.longitude, pt.longitude);
});

Deno.test('barycenter — empty array returns null', () => {
  assertEquals(computeBarycenter([]), null);
});

Deno.test('merge — saved place within 2× radius is included', () => {
  const barycenter = { latitude: 48.860, longitude: 2.350 };
  const RADIUS = 800;
  // ~300 m away from barycenter (well within 2× radius = 1600 m)
  const sp = { latitude: 48.863, longitude: 2.354, name: 'Le Bistrot', user_id: 'u1' };
  const merged = mergeSavedPlaces([], [sp], barycenter, RADIUS);
  assertEquals(merged.length, 1);
});

Deno.test('merge — saved place beyond 2× radius is excluded', () => {
  const barycenter = { latitude: 48.860, longitude: 2.350 };
  const RADIUS = 800; // 2× = 1600 m
  // ~5 km away
  const sp = { latitude: 48.905, longitude: 2.350, name: 'Far Bar', user_id: 'u1' };
  const merged = mergeSavedPlaces([], [sp], barycenter, RADIUS);
  assertEquals(merged.length, 0);
});

Deno.test('merge — saved place within 50 m of Google result is deduplicated', () => {
  const barycenter = { latitude: 48.860, longitude: 2.350 };
  const RADIUS = 800;
  // Google result at barycenter
  const googlePlace = { latitude: 48.860, longitude: 2.350 };
  // Saved place 30 m away from Google result → deduped
  const sp = { latitude: 48.8603, longitude: 2.3504, name: 'Same Bar', user_id: 'u1' };
  const merged = mergeSavedPlaces([googlePlace], [sp], barycenter, RADIUS);
  assertEquals(merged.length, 0);
});

Deno.test('merge — saved place 60 m from Google result is kept', () => {
  const barycenter = { latitude: 48.860, longitude: 2.350 };
  const RADIUS = 800;
  // Google result at barycenter
  const googlePlace = { latitude: 48.860, longitude: 2.350 };
  // Saved place ~60 m away from Google result → different venue, kept
  const sp = { latitude: 48.8605, longitude: 2.351, name: 'Different Bar', user_id: 'u1' };
  const merged = mergeSavedPlaces([googlePlace], [sp], barycenter, RADIUS);
  assertEquals(merged.length, 1);
});

Deno.test('merge — multiple saved places filtered correctly', () => {
  const barycenter = { latitude: 48.860, longitude: 2.350 };
  const RADIUS = 800;
  const googlePlaces = [{ latitude: 48.861, longitude: 2.351 }];
  const saved = [
    { latitude: 48.863, longitude: 2.355, name: 'Good Place', user_id: 'u1' },   // within radius, not deduped
    { latitude: 48.905, longitude: 2.350, name: 'Too Far', user_id: 'u2' },       // beyond 2× radius
    { latitude: 48.8611, longitude: 2.3511, name: 'Near Google', user_id: 'u3' }, // within 50 m of google
  ];
  const merged = mergeSavedPlaces(googlePlaces, saved, barycenter, RADIUS);
  assertEquals(merged.length, 1);
  assertEquals(merged[0].name, 'Good Place');
});

Deno.test('haversine — points <10 m apart give near-zero distance', () => {
  const a = { latitude: 48.860, longitude: 2.350 };
  const b = { latitude: 48.8601, longitude: 2.3501 };
  const dist = haversineMeters(a, b);
  assertEquals(dist < 20, true);
});
