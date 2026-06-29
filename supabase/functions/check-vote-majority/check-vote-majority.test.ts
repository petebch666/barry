/**
 * Unit tests for check-vote-majority business logic.
 * Run with: deno test supabase/functions/check-vote-majority/check-vote-majority.test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// ─── Extracted pure functions (copied from index.ts for unit testing) ────────

interface LatLng { latitude: number; longitude: number; }

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.latitude))*Math.cos(toRad(b.latitude))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
}

function computeBarycenter(points: LatLng[]): LatLng | null {
  if (!points.length) return null;
  let latSum = 0, lngSum = 0;
  for (const p of points) { latSum += p.latitude; lngSum += p.longitude; }
  return { latitude: latSum / points.length, longitude: lngSum / points.length };
}

function hasMajority(voteCounts: Record<string, number>, totalIn: number): boolean {
  const max = Math.max(...Object.values(voteCounts));
  return max / totalIn > 0.5;
}

function pickWinner(
  voteCounts: Record<string, number>,
  places: { id: string; latitude: number; longitude: number }[],
  barycenter: LatLng | null,
): string {
  const maxVotes = Math.max(...Object.values(voteCounts));
  const tied = Object.entries(voteCounts).filter(([, c]) => c === maxVotes).map(([id]) => id);
  if (tied.length === 1) return tied[0];
  if (!barycenter) return tied.sort()[0];
  return places
    .filter((p) => tied.includes(p.id))
    .reduce(
      (closest, place) => {
        const dist = haversineMeters(barycenter, place);
        return dist < closest.dist ? { id: place.id, dist } : closest;
      },
      { id: tied[0], dist: Infinity },
    ).id;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

Deno.test('majority — 3 of 5 votes (>50%) triggers confirmation', () => {
  const counts = { 'place-a': 3, 'place-b': 2 };
  assertEquals(hasMajority(counts, 5), true);
});

Deno.test('majority — exactly 50% does NOT trigger confirmation', () => {
  const counts = { 'place-a': 2, 'place-b': 2 };
  assertEquals(hasMajority(counts, 4), false);
});

Deno.test('majority — 2 of 3 votes (>50%) triggers confirmation', () => {
  const counts = { 'place-a': 2, 'place-b': 1 };
  assertEquals(hasMajority(counts, 3), true);
});

Deno.test('majority — 1 of 2 votes does NOT trigger (50%)', () => {
  const counts = { 'place-a': 1, 'place-b': 1 };
  assertEquals(hasMajority(counts, 2), false);
});

Deno.test('winner — clear leader is picked', () => {
  const counts = { 'place-a': 4, 'place-b': 1 };
  const winner = pickWinner(counts, [], null);
  assertEquals(winner, 'place-a');
});

Deno.test('tie-break — closest place to barycenter wins', () => {
  // Barycenter at Châtelet, Paris
  const barycenter = { latitude: 48.8601, longitude: 2.3477 };
  const counts = { 'near': 3, 'far': 3 };
  const places = [
    { id: 'near', latitude: 48.861, longitude: 2.348 }, // ~130 m from barycenter
    { id: 'far',  latitude: 48.876, longitude: 2.331 }, // ~2 km from barycenter
  ];
  const winner = pickWinner(counts, places, barycenter);
  assertEquals(winner, 'near');
});

Deno.test('tie-break — no location data falls back to alphabetical sort', () => {
  const counts = { 'place-b': 2, 'place-a': 2 };
  const winner = pickWinner(counts, [], null);
  assertEquals(winner, 'place-a');
});

Deno.test('barycenter — returns null for empty array', () => {
  assertEquals(computeBarycenter([]), null);
});

Deno.test('barycenter — midpoint of two symmetric points', () => {
  const result = computeBarycenter([
    { latitude: 48.0, longitude: 2.0 },
    { latitude: 50.0, longitude: 4.0 },
  ]);
  assertEquals(result?.latitude.toFixed(4), '49.0000');
  assertEquals(result?.longitude.toFixed(4), '3.0000');
});
