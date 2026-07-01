import { SuggestPlaceSchema, LatLngSchema } from '@/schemas';

// ─── SuggestPlaceSchema validation ────────────────────────────────────────────
// useSuggestPlace calls SuggestPlaceSchema.parse(input) before any DB write.

describe('SuggestPlaceSchema', () => {
  const validPingId = '550e8400-e29b-41d4-a716-446655440000';
  const base = {
    ping_id: validPingId,
    name: 'Le Select',
    latitude: 48.8566,
    longitude: 2.3522,
  };

  test('rejects empty name', () => {
    expect(() => SuggestPlaceSchema.parse({ ...base, name: '' })).toThrow();
  });

  test('rejects name over 200 characters', () => {
    expect(() => SuggestPlaceSchema.parse({ ...base, name: 'x'.repeat(201) })).toThrow();
  });

  test('rejects non-UUID ping_id', () => {
    expect(() => SuggestPlaceSchema.parse({ ...base, ping_id: 'not-a-uuid' })).toThrow();
  });

  test('rejects rating below 0', () => {
    expect(() => SuggestPlaceSchema.parse({ ...base, rating: -0.1 })).toThrow();
  });

  test('rejects rating above 5', () => {
    expect(() => SuggestPlaceSchema.parse({ ...base, rating: 5.1 })).toThrow();
  });

  test('accepts valid minimal place', () => {
    expect(() => SuggestPlaceSchema.parse(base)).not.toThrow();
  });

  test('accepts place with all optional fields', () => {
    expect(() => SuggestPlaceSchema.parse({
      ...base,
      address: '99 Rue du Bac, Paris',
      category: 'cafe',
      rating: 4.5,
    })).not.toThrow();
  });
});

// ─── LatLngSchema validation ───────────────────────────────────────────────────

describe('LatLngSchema', () => {
  test('rejects latitude below -90', () => {
    expect(() => LatLngSchema.parse({ latitude: -91, longitude: 0 })).toThrow();
  });

  test('rejects latitude above 90', () => {
    expect(() => LatLngSchema.parse({ latitude: 91, longitude: 0 })).toThrow();
  });

  test('rejects longitude below -180', () => {
    expect(() => LatLngSchema.parse({ latitude: 0, longitude: -181 })).toThrow();
  });

  test('rejects longitude above 180', () => {
    expect(() => LatLngSchema.parse({ latitude: 0, longitude: 181 })).toThrow();
  });

  test('accepts boundary values', () => {
    expect(() => LatLngSchema.parse({ latitude: -90, longitude: -180 })).not.toThrow();
    expect(() => LatLngSchema.parse({ latitude: 90, longitude: 180 })).not.toThrow();
  });
});
