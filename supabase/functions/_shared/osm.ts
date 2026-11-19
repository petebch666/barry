// Venue lookup around the meeting point, from OpenStreetMap only (no Google).
//
// Overpass is the richer source but its public servers are often saturated:
// in production every mirror answered 406/429/502/504 or timed out, and a
// successful query took 30–35 s. So: one Overpass attempt with a bounded
// wait, then Nominatim's amenity search, which answers in about a second.
// Both return OSM ids, so `node/123` from either source dedupes the same way.

export interface LatLng { latitude: number; longitude: number; }

export interface VenueCandidate {
  externalId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  category: string | null;
}

export const AMENITIES = ['restaurant', 'bar'] as const;
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
export const OVERPASS_TIMEOUT_MS = 20_000;
export const NOMINATIM_TIMEOUT_MS = 8_000;
// Both services' usage policies ask clients to identify themselves.
export const USER_AGENT = 'BarryApp/1.0 (social meetup app)';

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function buildOverpassQuery(center: LatLng, radiusM: number, limit: number): string {
  const around = `(around:${radiusM},${center.latitude},${center.longitude})`;
  const filter = `["amenity"~"^(${AMENITIES.join('|')})$"]`;
  return [
    '[out:json][timeout:25];',
    '(',
    `  node${filter}${around};`,
    `  way${filter}${around};`,
    ');',
    `out body center ${limit};`,
  ].join('\n');
}

export function parseOverpassElements(elements: OsmElement[]): VenueCandidate[] {
  const out: VenueCandidate[] = [];
  for (const el of elements) {
    const lat = el.type === 'node' ? el.lat : el.center?.lat;
    const lon = el.type === 'node' ? el.lon : el.center?.lon;
    const tags = el.tags ?? {};
    if (lat == null || lon == null || !tags.name) continue;

    const parts: string[] = [];
    if (tags['addr:housenumber'] && tags['addr:street']) parts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
    else if (tags['addr:street']) parts.push(tags['addr:street']);
    if (tags['addr:city']) parts.push(tags['addr:city']);

    out.push({
      externalId: `${el.type}/${el.id}`,
      name: tags.name,
      address: parts.join(', ') || null,
      latitude: lat,
      longitude: lon,
      category: tags.amenity ?? null,
    });
  }
  return out;
}

export interface NominatimResult {
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  name?: string;
  type?: string;
  address?: Record<string, string>;
}

/** A bounded box around the point, which is how Nominatim restricts a search to an area. */
export function nominatimUrl(center: LatLng, radiusM: number, amenity: string, limit: number): string {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos(center.latitude * Math.PI / 180));
  const params = new URLSearchParams({
    amenity,
    viewbox: [center.longitude - dLng, center.latitude + dLat, center.longitude + dLng, center.latitude - dLat]
      .map((n) => n.toFixed(6)).join(','),
    bounded: '1',
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(Math.min(limit, 40)),
  });
  return `${NOMINATIM_URL}?${params}`;
}

export function parseNominatimResults(results: NominatimResult[]): VenueCandidate[] {
  const out: VenueCandidate[] = [];
  for (const r of results) {
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    if (!r.name || !r.osm_type || r.osm_id == null || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const a = r.address ?? {};
    const street = a.house_number && a.road ? `${a.house_number} ${a.road}` : a.road;
    const city = a.city ?? a.town ?? a.village;
    out.push({
      externalId: `${r.osm_type}/${r.osm_id}`,
      name: r.name,
      address: [street, city].filter(Boolean).join(', ') || null,
      latitude: lat,
      longitude: lon,
      category: r.type ?? null,
    });
  }
  return out;
}

async function fetchWithTimeout(fetchFn: typeof fetch, url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface VenueLookup {
  source: 'overpass' | 'nominatim' | 'none';
  candidates: VenueCandidate[];
}

/**
 * Logs carry the source and status only: never the coordinates, which are
 * derived from members' locations and must not outlive the ping.
 */
export async function findVenues(
  center: LatLng,
  radiusM: number,
  limit: number,
  fetchFn: typeof fetch = fetch,
): Promise<VenueLookup> {
  try {
    const res = await fetchWithTimeout(fetchFn, OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
      body: `data=${encodeURIComponent(buildOverpassQuery(center, radiusM, limit))}`,
    }, OVERPASS_TIMEOUT_MS);
    if (res.ok) {
      const { elements = [] } = await res.json() as { elements?: OsmElement[] };
      return { source: 'overpass', candidates: parseOverpassElements(elements) };
    }
    await res.body?.cancel();
    console.warn(`Overpass returned ${res.status}, falling back to Nominatim`);
  } catch (err) {
    console.warn('Overpass failed or timed out, falling back to Nominatim:', err instanceof Error ? err.name : err);
  }

  // Nominatim's policy allows at most one request per second.
  const candidates: VenueCandidate[] = [];
  let anyOk = false;
  for (const [i, amenity] of AMENITIES.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1_100));
    try {
      const res = await fetchWithTimeout(fetchFn, nominatimUrl(center, radiusM, amenity, limit), {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      }, NOMINATIM_TIMEOUT_MS);
      if (!res.ok) {
        await res.body?.cancel();
        console.warn(`Nominatim (${amenity}) returned ${res.status}`);
        continue;
      }
      anyOk = true;
      candidates.push(...parseNominatimResults(await res.json() as NominatimResult[]));
    } catch (err) {
      console.warn(`Nominatim (${amenity}) failed:`, err instanceof Error ? err.name : err);
    }
  }
  return { source: anyOk ? 'nominatim' : 'none', candidates };
}
