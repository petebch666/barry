/**
 * Unit tests for notify-rsvp-change business logic.
 * Run with: deno test supabase/functions/notify-rsvp-change/notify-rsvp-change.test.ts
 */
import { assertEquals, assertExists, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// ─── Extracted pure functions (mirrored from index.ts for unit testing) ────────

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
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

const SHIFT_THRESHOLD_M = 1_000;

function shouldActOnLeave(
  record: { status: string },
  old_record?: { status: string },
): boolean {
  return old_record?.status === 'in' && record.status !== 'in';
}

function exceedsShiftThreshold(oldCenter: LatLng, newCenter: LatLng): boolean {
  return haversineMeters(oldCenter, newCenter) >= SHIFT_THRESHOLD_M;
}

// ─── Tests — leave detection ───────────────────────────────────────────────────

Deno.test('shouldActOnLeave — in → out triggers action', () => {
  assertEquals(shouldActOnLeave({ status: 'out' }, { status: 'in' }), true);
});

Deno.test('shouldActOnLeave — in → maybe triggers action', () => {
  assertEquals(shouldActOnLeave({ status: 'maybe' }, { status: 'in' }), true);
});

Deno.test('shouldActOnLeave — maybe → out is skipped (was not "in")', () => {
  assertEquals(shouldActOnLeave({ status: 'out' }, { status: 'maybe' }), false);
});

Deno.test('shouldActOnLeave — new RSVP with no prior record is skipped', () => {
  assertEquals(shouldActOnLeave({ status: 'in' }, undefined), false);
});

Deno.test('shouldActOnLeave — in → in (location update) is skipped', () => {
  assertEquals(shouldActOnLeave({ status: 'in' }, { status: 'in' }), false);
});

// ─── Tests — shift threshold ───────────────────────────────────────────────────

Deno.test('exceedsShiftThreshold — 3 km shift exceeds 1 km threshold', () => {
  // ~3 km north of Paris centre (0.027° ≈ 3 km at this latitude)
  const oldCenter = { latitude: 48.860, longitude: 2.350 };
  const newCenter = { latitude: 48.887, longitude: 2.350 };
  assertEquals(exceedsShiftThreshold(oldCenter, newCenter), true);
});

Deno.test('exceedsShiftThreshold — 500 m shift is below threshold', () => {
  // ~500 m north (0.0045° ≈ 500 m)
  const oldCenter = { latitude: 48.860, longitude: 2.350 };
  const newCenter = { latitude: 48.8645, longitude: 2.350 };
  assertEquals(exceedsShiftThreshold(oldCenter, newCenter), false);
});

Deno.test('exceedsShiftThreshold — identical centers produce zero shift', () => {
  const center = { latitude: 48.860, longitude: 2.350 };
  assertEquals(exceedsShiftThreshold(center, center), false);
});

// ─── Tests — barycenter recalculation on leave ────────────────────────────────

Deno.test('barycenter — leaver excluded; center moves toward remaining members', () => {
  // Alice is north, Bob is south, Charlie is far east.
  // Charlie leaves → new center should shift west.
  const alice = { latitude: 48.87, longitude: 2.35 };
  const bob   = { latitude: 48.85, longitude: 2.35 };
  const charlie = { latitude: 48.86, longitude: 2.60 }; // far east

  const newCenter = computeBarycenter([alice, bob]);
  const oldCenter = computeBarycenter([alice, bob, charlie]);

  assertExists(newCenter);
  assertExists(oldCenter);
  // Removing the eastern outlier pulls center westward
  assertEquals(newCenter.longitude < oldCenter.longitude, true);
});

Deno.test('barycenter — single remaining member after leave', () => {
  const alice = { latitude: 48.87, longitude: 2.35 };
  const newCenter = computeBarycenter([alice]);
  assertExists(newCenter);
  assertEquals(newCenter.latitude, alice.latitude);
  assertEquals(newCenter.longitude, alice.longitude);
});

Deno.test('barycenter — no remaining members returns null (function returns early)', () => {
  assertEquals(computeBarycenter([]), null);
});

// ─── Tests — shift + notify logic integration ─────────────────────────────────

Deno.test('integration — 2km barycenter shift from leaver notifies remaining members', () => {
  // Three members: two close together, one outlier 4 km away.
  // Outlier leaves → new barycenter moves ~2 km toward the pair.
  const pair1 = { latitude: 48.860, longitude: 2.350 };
  const pair2 = { latitude: 48.862, longitude: 2.352 };
  const outlier = { latitude: 48.896, longitude: 2.350 }; // ~4 km north

  const oldCenter = computeBarycenter([pair1, pair2, outlier]);
  const newCenter = computeBarycenter([pair1, pair2]);

  assertExists(oldCenter);
  assertExists(newCenter);

  const shift = haversineMeters(oldCenter, newCenter);
  assertEquals(shift >= SHIFT_THRESHOLD_M, true, `Expected shift ≥ 1000 m, got ${Math.round(shift)} m`);
});

// ─── Tests — Overpass query builder (mirrored from index.ts) ─────────────────

function buildOverpassQuery(lat: number, lng: number, radiusM: number, limit = 15): string {
  return [
    '[out:json][timeout:10];',
    '(',
    `  node["amenity"~"^(restaurant|bar)$"](around:${radiusM},${lat},${lng});`,
    `  way["amenity"~"^(restaurant|bar)$"](around:${radiusM},${lat},${lng});`,
    ');',
    `out body center ${limit};`,
  ].join('\n');
}

Deno.test('overpass query — narrowed to restaurant/bar only, consistent with fetch-nearby-places', () => {
  const q = buildOverpassQuery(48.86, 2.35, 800);
  assertStringIncludes(q, '^(restaurant|bar)$');
  assertEquals(q.includes('cafe'), false);
  assertEquals(q.includes('pub'), false);
});
