import { computeBarycenter, haversineMeters, type GeoPoint } from '../barycenter';

describe('computeBarycenter', () => {
  it('returns null for an empty array', () => {
    expect(computeBarycenter([])).toBeNull();
  });

  it('returns the point itself for a single input', () => {
    const result = computeBarycenter([{ latitude: 48.8566, longitude: 2.3522 }]);
    expect(result).toEqual({ latitude: 48.8566, longitude: 2.3522 });
  });

  it('computes the midpoint of two equidistant points', () => {
    const points: GeoPoint[] = [
      { latitude: 48.0, longitude: 2.0 },
      { latitude: 50.0, longitude: 4.0 },
    ];
    const result = computeBarycenter(points);
    expect(result?.latitude).toBeCloseTo(49.0, 5);
    expect(result?.longitude).toBeCloseTo(3.0, 5);
  });

  it('applies weights correctly', () => {
    const points: GeoPoint[] = [
      { latitude: 0.0, longitude: 0.0, weight: 3 },
      { latitude: 10.0, longitude: 10.0, weight: 1 },
    ];
    // Weighted mean: (0*3 + 10*1) / 4 = 2.5
    const result = computeBarycenter(points);
    expect(result?.latitude).toBeCloseTo(2.5, 5);
    expect(result?.longitude).toBeCloseTo(2.5, 5);
  });

  it('handles all points at the same location', () => {
    const points: GeoPoint[] = [
      { latitude: 48.8566, longitude: 2.3522 },
      { latitude: 48.8566, longitude: 2.3522 },
      { latitude: 48.8566, longitude: 2.3522 },
    ];
    const result = computeBarycenter(points);
    expect(result?.latitude).toBeCloseTo(48.8566, 5);
    expect(result?.longitude).toBeCloseTo(2.3522, 5);
  });

  it('handles negative longitudes (Western hemisphere)', () => {
    // New York and London
    const points: GeoPoint[] = [
      { latitude: 40.7128, longitude: -74.006 },
      { latitude: 51.5074, longitude: -0.1278 },
    ];
    const result = computeBarycenter(points);
    expect(result?.latitude).toBeCloseTo(46.1101, 2);
    expect(result?.longitude).toBeCloseTo(-37.0669, 2);
  });
});

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    const p = { latitude: 48.8566, longitude: 2.3522 };
    expect(haversineMeters(p, p)).toBeCloseTo(0, 0);
  });

  it('approximates known distance between Paris landmarks (~4.1 km)', () => {
    // Eiffel Tower to Notre-Dame — straight-line ~4 100 m (dominant component is east–west)
    const eiffelTower = { latitude: 48.8584, longitude: 2.2945 };
    const notredam = { latitude: 48.8530, longitude: 2.3499 };
    const distance = haversineMeters(eiffelTower, notredam);
    expect(distance).toBeGreaterThan(3900);
    expect(distance).toBeLessThan(4300);
  });

  it('is symmetric (a→b === b→a)', () => {
    const a = { latitude: 48.8566, longitude: 2.3522 };
    const b = { latitude: 48.8634, longitude: 2.3736 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 5);
  });

  it('handles points on the same latitude', () => {
    const a = { latitude: 0.0, longitude: 0.0 };
    const b = { latitude: 0.0, longitude: 1.0 };
    // 1 degree longitude at equator ≈ 111 320 m
    const distance = haversineMeters(a, b);
    expect(distance).toBeGreaterThan(111_000);
    expect(distance).toBeLessThan(112_000);
  });
});
