import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildOverpassQuery, findVenues, GEOAPIFY_URL, geoapifyUrl, nominatimUrl, NOMINATIM_URL, OVERPASS_URL,
  parseGeoapifyFeatures, parseNominatimResults, parseOverpassElements,
} from './osm.ts';

const CENTER = { latitude: 48.8606, longitude: 2.3376 };

Deno.test('buildOverpassQuery — restaurants and bars around the point, limited', () => {
  const q = buildOverpassQuery(CENTER, 400, 30);
  assertStringIncludes(q, '["amenity"~"^(restaurant|bar)$"](around:400,48.8606,2.3376)');
  assertStringIncludes(q, 'out body center 30;');
});

Deno.test('parseOverpassElements — maps nodes and ways, skips unnamed', () => {
  const out = parseOverpassElements([
    { type: 'node', id: 1, lat: 48.86, lon: 2.33, tags: { name: 'Le Bar', amenity: 'bar', 'addr:housenumber': '3', 'addr:street': 'Rue X', 'addr:city': 'Paris' } },
    { type: 'way', id: 2, center: { lat: 48.87, lon: 2.34 }, tags: { name: 'Chez Y', amenity: 'restaurant' } },
    { type: 'node', id: 3, lat: 48.86, lon: 2.33, tags: { amenity: 'bar' } },
  ]);
  assertEquals(out, [
    { externalId: 'node/1', name: 'Le Bar', address: '3 Rue X, Paris', latitude: 48.86, longitude: 2.33, category: 'bar' },
    { externalId: 'way/2', name: 'Chez Y', address: null, latitude: 48.87, longitude: 2.34, category: 'restaurant' },
  ]);
});

Deno.test('nominatimUrl — bounded box of the radius around the point', () => {
  const url = new URL(nominatimUrl(CENTER, 400, 'bar', 90));
  assertEquals(url.origin + url.pathname, NOMINATIM_URL);
  assertEquals(url.searchParams.get('amenity'), 'bar');
  assertEquals(url.searchParams.get('bounded'), '1');
  assertEquals(url.searchParams.get('limit'), '40', 'Nominatim caps limit at 40');
  const [west, north, east, south] = url.searchParams.get('viewbox')!.split(',').map(Number);
  assert(west < CENTER.longitude && east > CENTER.longitude);
  assert(south < CENTER.latitude && north > CENTER.latitude);
  assert(Math.abs((north - south) / 2 - 400 / 111_320) < 1e-5, 'half-height is the radius');
});

Deno.test('parseNominatimResults — same id format as Overpass, address from details', () => {
  const out = parseNominatimResults([
    { osm_type: 'node', osm_id: 1, lat: '48.86', lon: '2.33', name: 'Le Bar', type: 'bar', address: { house_number: '3', road: 'Rue X', city: 'Paris' } },
    { osm_type: 'way', osm_id: 2, lat: '48.87', lon: '2.34', name: '', type: 'bar' },
    { osm_type: 'node', osm_id: 4, lat: 'nope', lon: '2.34', name: 'Bad coords' },
  ]);
  assertEquals(out, [
    { externalId: 'node/1', name: 'Le Bar', address: '3 Rue X, Paris', latitude: 48.86, longitude: 2.33, category: 'bar' },
  ]);
});

function fakeFetch(routes: {
  overpass: () => Response | Promise<Response>;
  nominatim: (amenity: string) => Response;
  geoapify?: () => Response;
}) {
  const calls: string[] = [];
  const fn = ((url: string) => {
    if (url.startsWith(GEOAPIFY_URL)) { calls.push('geoapify'); return Promise.resolve(routes.geoapify!()); }
    if (url === OVERPASS_URL) { calls.push('overpass'); return Promise.resolve(routes.overpass()); }
    const amenity = new URL(url).searchParams.get('amenity') ?? '';
    calls.push(`nominatim:${amenity}`);
    return Promise.resolve(routes.nominatim(amenity));
  }) as typeof fetch;
  return { fn, calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

Deno.test('findVenues — uses Overpass when it answers', async () => {
  const { fn, calls } = fakeFetch({
    overpass: () => json({ elements: [{ type: 'node', id: 1, lat: 48.86, lon: 2.33, tags: { name: 'A', amenity: 'bar' } }] }),
    nominatim: () => json([]),
  });
  const r = await findVenues(CENTER, 400, 30, fn, null);
  assertEquals(r.source, 'overpass');
  assertEquals(r.candidates.map((c) => c.externalId), ['node/1']);
  assertEquals(calls, ['overpass']);
});

Deno.test('findVenues — falls back to Nominatim for bars and restaurants when Overpass is saturated', async () => {
  const { fn, calls } = fakeFetch({
    overpass: () => new Response('at capacity', { status: 406 }),
    nominatim: (amenity) => json([{ osm_type: 'node', osm_id: amenity === 'bar' ? 1 : 2, lat: '48.86', lon: '2.33', name: amenity, type: amenity }]),
  });
  const r = await findVenues(CENTER, 400, 30, fn, null);
  assertEquals(r.source, 'nominatim');
  assertEquals(r.candidates.map((c) => c.externalId), ['node/2', 'node/1']);
  assertEquals(calls, ['overpass', 'nominatim:restaurant', 'nominatim:bar']);
});

Deno.test('findVenues — falls back when Overpass throws (timeout)', async () => {
  const { fn } = fakeFetch({
    overpass: () => { throw new DOMException('aborted', 'AbortError'); },
    nominatim: () => json([]),
  });
  const r = await findVenues(CENTER, 400, 30, fn, null);
  assertEquals(r.source, 'nominatim');
});

Deno.test('findVenues — reports none when every source fails', async () => {
  const { fn } = fakeFetch({ overpass: () => json({}, 502), nominatim: () => json({}, 503) });
  const r = await findVenues(CENTER, 400, 30, fn, null);
  assertEquals(r, { source: 'none', candidates: [] });
});

Deno.test('findVenues — never logs the coordinates', async () => {
  const logged: string[] = [];
  const original = { warn: console.warn, log: console.log, error: console.error };
  console.warn = console.log = console.error = (...args: unknown[]) => { logged.push(args.map(String).join(' ')); };
  try {
    const { fn } = fakeFetch({ overpass: () => json({}, 504), nominatim: () => json({}, 503) });
    await findVenues(CENTER, 400, 30, fn, null);
  } finally {
    Object.assign(console, original);
  }
  assert(logged.length > 0);
  for (const line of logged) {
    assert(!line.includes('48.86') && !line.includes('2.33'), `coordinates in log: ${line}`);
  }
});

Deno.test('geoapifyUrl — restaurants and bars in a circle, nearest first (lon before lat)', () => {
  const url = new URL(geoapifyUrl(CENTER, 400, 30, 'test-key'));
  assertEquals(url.origin + url.pathname, GEOAPIFY_URL);
  assertEquals(url.searchParams.get('categories'), 'catering.restaurant,catering.bar');
  assertEquals(url.searchParams.get('filter'), 'circle:2.3376,48.8606,400');
  assertEquals(url.searchParams.get('bias'), 'proximity:2.3376,48.8606');
  assertEquals(url.searchParams.get('limit'), '30');
  assertEquals(url.searchParams.get('apiKey'), 'test-key');
});

Deno.test('parseGeoapifyFeatures — OSM ids in the same form as Overpass, with address and category', () => {
  const out = parseGeoapifyFeatures([
    { properties: { name: 'Le Bar', lat: 48.86, lon: 2.33, housenumber: '3', street: 'Rue X', city: 'Paris',
      categories: ['catering', 'catering.bar'], place_id: 'abc', datasource: { sourcename: 'openstreetmap', raw: { osm_id: 1, osm_type: 'n' } } } },
    { properties: { name: 'Chez Y', lat: 48.87, lon: 2.34, categories: ['catering.restaurant.french', 'catering.restaurant'],
      datasource: { raw: { osm_id: 2, osm_type: 'w' } } } },
    { properties: { name: 'No OSM id', lat: 48.87, lon: 2.34, place_id: 'p-9', categories: ['catering.bar'] } },
    { properties: { lat: 48.87, lon: 2.34, place_id: 'unnamed' } },
  ]);
  assertEquals(out, [
    { externalId: 'node/1', name: 'Le Bar', address: '3 Rue X, Paris', latitude: 48.86, longitude: 2.33, category: 'bar' },
    { externalId: 'way/2', name: 'Chez Y', address: null, latitude: 48.87, longitude: 2.34, category: 'restaurant' },
    { externalId: 'geoapify/p-9', name: 'No OSM id', address: null, latitude: 48.87, longitude: 2.34, category: 'bar' },
  ]);
});

Deno.test('findVenues — uses Geoapify when a key is set, without touching the public services', async () => {
  const { fn, calls } = fakeFetch({
    geoapify: () => json({ features: [{ properties: { name: 'A', lat: 48.86, lon: 2.33, categories: ['catering.bar'], datasource: { raw: { osm_id: 5, osm_type: 'n' } } } }] }),
    overpass: () => json({}, 500),
    nominatim: () => json([]),
  });
  const r = await findVenues(CENTER, 400, 30, fn, 'test-key');
  assertEquals(r.source, 'geoapify');
  assertEquals(r.candidates.map((c) => c.externalId), ['node/5']);
  assertEquals(calls, ['geoapify']);
});

Deno.test('findVenues — falls back to the public services when Geoapify fails', async () => {
  const { fn, calls } = fakeFetch({
    geoapify: () => json({ error: 'quota' }, 429),
    overpass: () => json({ elements: [{ type: 'node', id: 7, lat: 48.86, lon: 2.33, tags: { name: 'B', amenity: 'bar' } }] }),
    nominatim: () => json([]),
  });
  const r = await findVenues(CENTER, 400, 30, fn, 'test-key');
  assertEquals(r.source, 'overpass');
  assertEquals(calls, ['geoapify', 'overpass']);
});

Deno.test('findVenues — the API key never reaches the logs', async () => {
  const logged: string[] = [];
  const original = { warn: console.warn, log: console.log, error: console.error };
  console.warn = console.log = console.error = (...args: unknown[]) => { logged.push(args.map(String).join(' ')); };
  try {
    const { fn } = fakeFetch({ geoapify: () => json({}, 401), overpass: () => json({}, 406), nominatim: () => json({}, 403) });
    await findVenues(CENTER, 400, 30, fn, 'secret-key-123');
  } finally {
    Object.assign(console, original);
  }
  for (const line of logged) assert(!line.includes('secret-key-123'), `key in log: ${line}`);
});
