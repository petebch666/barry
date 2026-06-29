export interface GeoPoint {
  latitude: number;
  longitude: number;
  /** Defaults to 1. Reserved for future recency-weighting. */
  weight?: number;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Arithmetic mean of lat/lng coordinates.
 *
 * Accurate for city-scale distances (<50 km). Would need ECEF 3D averaging
 * for cross-city or international use cases, but Barry is a local meetup app.
 */
export function computeBarycenter(points: GeoPoint[]): LatLng | null {
  if (points.length === 0) return null;

  let latSum = 0;
  let lngSum = 0;
  let totalWeight = 0;

  for (const p of points) {
    const w = p.weight ?? 1;
    latSum += p.latitude * w;
    lngSum += p.longitude * w;
    totalWeight += w;
  }

  return {
    latitude: latSum / totalWeight,
    longitude: lngSum / totalWeight,
  };
}

/**
 * Haversine distance in metres between two lat/lng points.
 * Used for "X m away" labels on place cards and tie-break in vote resolution.
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const sinHalfDLat = Math.sin(dLat / 2);
  const sinHalfDLng = Math.sin(dLng / 2);
  const chord =
    sinHalfDLat * sinHalfDLat +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      sinHalfDLng *
      sinHalfDLng;
  return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
