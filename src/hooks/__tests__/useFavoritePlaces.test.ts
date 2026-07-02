import { RatePlaceSchema, UpdateSavedPlaceSchema } from '@/schemas';

// ─── RatePlaceSchema validation ────────────────────────────────────────────────
// useRatePlace calls RatePlaceSchema.parse(input) before any DB write.

describe('RatePlaceSchema', () => {
  const validPlaceId = '550e8400-e29b-41d4-a716-446655440000';

  test('accepts loved_it', () => {
    expect(() => RatePlaceSchema.parse({ place_id: validPlaceId, rating: 'loved_it' })).not.toThrow();
  });

  test('accepts it_was_fine', () => {
    expect(() => RatePlaceSchema.parse({ place_id: validPlaceId, rating: 'it_was_fine' })).not.toThrow();
  });

  test('accepts not_for_me', () => {
    expect(() => RatePlaceSchema.parse({ place_id: validPlaceId, rating: 'not_for_me' })).not.toThrow();
  });

  test('rejects an invalid rating value', () => {
    expect(() => RatePlaceSchema.parse({ place_id: validPlaceId, rating: 'five_stars' })).toThrow();
  });

  test('rejects non-UUID place_id', () => {
    expect(() => RatePlaceSchema.parse({ place_id: 'not-a-uuid', rating: 'loved_it' })).toThrow();
  });

  test('rejects missing rating', () => {
    expect(() => RatePlaceSchema.parse({ place_id: validPlaceId })).toThrow();
  });
});

// ─── UpdateSavedPlaceSchema validation ─────────────────────────────────────────
// useUpdateSavedPlace calls UpdateSavedPlaceSchema.parse(input) before any DB write.

describe('UpdateSavedPlaceSchema', () => {
  test('accepts a partial update (name only)', () => {
    expect(() => UpdateSavedPlaceSchema.parse({ name: 'Le Bar du Coin' })).not.toThrow();
  });

  test('accepts an empty object (no-op update)', () => {
    expect(() => UpdateSavedPlaceSchema.parse({})).not.toThrow();
  });

  test('accepts null address and category (clearing them)', () => {
    expect(() => UpdateSavedPlaceSchema.parse({ address: null, category: null })).not.toThrow();
  });

  test('rejects name over 200 characters', () => {
    expect(() => UpdateSavedPlaceSchema.parse({ name: 'x'.repeat(201) })).toThrow();
  });

  test('rejects empty string name', () => {
    expect(() => UpdateSavedPlaceSchema.parse({ name: '' })).toThrow();
  });

  test('rejects address over 500 characters', () => {
    expect(() => UpdateSavedPlaceSchema.parse({ address: 'x'.repeat(501) })).toThrow();
  });

  test('rejects category over 100 characters', () => {
    expect(() => UpdateSavedPlaceSchema.parse({ category: 'x'.repeat(101) })).toThrow();
  });
});
