/**
 * Unit tests for fetch-nearby-places business logic.
 * Run with: deno test supabase/functions/fetch-nearby-places/fetch-nearby-places.test.ts
 */
import { assertEquals, assertExists, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';

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
interface OsmPlace { latitude: number; longitude: number; }

function mergeSavedPlaces(
  osmPlaces: OsmPlace[],
  savedPlaces: SavedPlace[],
  barycenter: LatLng,
  searchRadius: number,
  dedupeThresholdM = 50,
): SavedPlace[] {
  return savedPlaces.filter((sp) => {
    const distFromCenter = haversineMeters(barycenter, sp);
    if (distFromCenter > searchRadius * 2) return false;
    const tooClose = osmPlaces.some(
      (op) => haversineMeters(op, sp) < dedupeThresholdM,
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

Deno.test('merge — saved place within 50 m of OSM result is deduplicated', () => {
  const barycenter = { latitude: 48.860, longitude: 2.350 };
  const RADIUS = 800;
  const osmPlace = { latitude: 48.860, longitude: 2.350 };
  // Saved place 30 m away from OSM result → deduped
  const sp = { latitude: 48.8603, longitude: 2.3504, name: 'Same Bar', user_id: 'u1' };
  const merged = mergeSavedPlaces([osmPlace], [sp], barycenter, RADIUS);
  assertEquals(merged.length, 0);
});

Deno.test('merge — saved place 60 m from OSM result is kept', () => {
  const barycenter = { latitude: 48.860, longitude: 2.350 };
  const RADIUS = 800;
  const osmPlace = { latitude: 48.860, longitude: 2.350 };
  // Saved place ~60 m away from OSM result → different venue, kept
  const sp = { latitude: 48.8605, longitude: 2.351, name: 'Different Bar', user_id: 'u1' };
  const merged = mergeSavedPlaces([osmPlace], [sp], barycenter, RADIUS);
  assertEquals(merged.length, 1);
});

Deno.test('merge — multiple saved places filtered correctly', () => {
  const barycenter = { latitude: 48.860, longitude: 2.350 };
  const RADIUS = 800;
  const osmPlaces = [{ latitude: 48.861, longitude: 2.351 }];
  const saved = [
    { latitude: 48.863, longitude: 2.355, name: 'Good Place', user_id: 'u1' },   // within radius, not deduped
    { latitude: 48.905, longitude: 2.350, name: 'Too Far', user_id: 'u2' },       // beyond 2× radius
    { latitude: 48.8611, longitude: 2.3511, name: 'Near OSM result', user_id: 'u3' }, // within 50 m of OSM
  ];
  const merged = mergeSavedPlaces(osmPlaces, saved, barycenter, RADIUS);
  assertEquals(merged.length, 1);
  assertEquals(merged[0].name, 'Good Place');
});

Deno.test('haversine — points <10 m apart give near-zero distance', () => {
  const a = { latitude: 48.860, longitude: 2.350 };
  const b = { latitude: 48.8601, longitude: 2.3501 };
  const dist = haversineMeters(a, b);
  assertEquals(dist < 20, true);
});

// ─── Overpass query builder ───────────────────────────────────────────────────

function buildOverpassQuery(lat: number, lng: number, radiusM: number): string {
  return [
    '[out:json][timeout:25];',
    '(',
    `  node["amenity"~"bar|pub|restaurant|cafe|biergarten|fast_food"](around:${radiusM},${lat},${lng});`,
    `  way["amenity"~"bar|pub|restaurant|cafe|biergarten|fast_food"](around:${radiusM},${lat},${lng});`,
    ');',
    'out body center;',
  ].join('\n');
}

Deno.test('overpass query — contains expected amenity filter', () => {
  const q = buildOverpassQuery(48.86, 2.35, 800);
  assertStringIncludes(q, 'amenity');
  assertStringIncludes(q, 'bar|pub|restaurant|cafe|biergarten|fast_food');
  assertStringIncludes(q, 'around:800');
  assertStringIncludes(q, '48.86');
  assertStringIncludes(q, '2.35');
  assertStringIncludes(q, 'out body center');
});

Deno.test('overpass query — timeout directive present', () => {
  const q = buildOverpassQuery(48.86, 2.35, 800);
  assertStringIncludes(q, '[timeout:25]');
});

// ─── OSM element parsing ──────────────────────────────────────────────────────

interface OsmElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function parseOsmElement(el: OsmElement): { lat: number; lon: number; name: string; address: string | null; category: string | null } | null {
  const lat = el.type === 'node' ? el.lat : el.center?.lat;
  const lon = el.type === 'node' ? el.lon : el.center?.lon;
  const tags = el.tags ?? {};
  if (!lat || !lon || !tags.name) return null;

  const addrParts: string[] = [];
  if (tags['addr:housenumber'] && tags['addr:street']) {
    addrParts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
  } else if (tags['addr:street']) {
    addrParts.push(tags['addr:street']);
  }
  if (tags['addr:city']) addrParts.push(tags['addr:city']);

  return {
    lat,
    lon,
    name: tags.name,
    address: addrParts.join(', ') || null,
    category: tags.amenity ?? null,
  };
}

Deno.test('parseOsmElement — node with name returns parsed place', () => {
  const el: OsmElement = {
    type: 'node', id: 1, lat: 48.86, lon: 2.35,
    tags: { name: 'Le Bar', amenity: 'bar', 'addr:street': 'Rue de Rivoli', 'addr:city': 'Paris' },
  };
  const result = parseOsmElement(el);
  assertExists(result);
  assertEquals(result.name, 'Le Bar');
  assertEquals(result.category, 'bar');
  assertEquals(result.address, 'Rue de Rivoli, Paris');
  assertEquals(result.lat, 48.86);
});

Deno.test('parseOsmElement — node without name is filtered out', () => {
  const el: OsmElement = { type: 'node', id: 2, lat: 48.86, lon: 2.35, tags: { amenity: 'bar' } };
  assertEquals(parseOsmElement(el), null);
});

Deno.test('parseOsmElement — way uses center coords', () => {
  const el: OsmElement = {
    type: 'way', id: 3, center: { lat: 48.87, lon: 2.36 },
    tags: { name: 'La Brasserie', amenity: 'restaurant' },
  };
  const result = parseOsmElement(el);
  assertExists(result);
  assertEquals(result.lat, 48.87);
  assertEquals(result.lon, 2.36);
  assertEquals(result.name, 'La Brasserie');
});

Deno.test('parseOsmElement — way without center is filtered out', () => {
  const el: OsmElement = {
    type: 'way', id: 4,
    tags: { name: 'No Center Bar', amenity: 'bar' },
  };
  assertEquals(parseOsmElement(el), null);
});

Deno.test('parseOsmElement — address with housenumber and street', () => {
  const el: OsmElement = {
    type: 'node', id: 5, lat: 48.86, lon: 2.35,
    tags: { name: 'Café de Flore', amenity: 'cafe', 'addr:housenumber': '172', 'addr:street': 'Boulevard Saint-Germain', 'addr:city': 'Paris' },
  };
  const result = parseOsmElement(el);
  assertExists(result);
  assertEquals(result.address, '172 Boulevard Saint-Germain, Paris');
});

Deno.test('parseOsmElement — no address tags gives null address', () => {
  const el: OsmElement = {
    type: 'node', id: 6, lat: 48.86, lon: 2.35,
    tags: { name: 'Mystery Bar', amenity: 'bar' },
  };
  const result = parseOsmElement(el);
  assertExists(result);
  assertEquals(result.address, null);
});

Deno.test('parseOsmElement — missing lat/lon on node returns null', () => {
  const el: OsmElement = { type: 'node', id: 7, tags: { name: 'Ghost Bar', amenity: 'bar' } };
  assertEquals(parseOsmElement(el), null);
});
