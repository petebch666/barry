import { CastVoteSchema } from '@/schemas';

// ─── Vote count computation ────────────────────────────────────────────────────
// Mirrors the reduce logic inside useVoteCounts for unit testing
// without needing React Query or a renderer.

function computeVoteCounts(
  votes: Array<{ place_id: string }>,
): Record<string, number> {
  return votes.reduce<Record<string, number>>((acc, v) => {
    acc[v.place_id] = (acc[v.place_id] ?? 0) + 1;
    return acc;
  }, {});
}

describe('computeVoteCounts', () => {
  test('counts votes per place correctly', () => {
    expect(computeVoteCounts([
      { place_id: 'place-a' },
      { place_id: 'place-b' },
      { place_id: 'place-a' },
    ])).toEqual({ 'place-a': 2, 'place-b': 1 });
  });

  test('returns empty object for no votes', () => {
    expect(computeVoteCounts([])).toEqual({});
  });

  test('single vote produces count of 1', () => {
    expect(computeVoteCounts([{ place_id: 'place-x' }])).toEqual({ 'place-x': 1 });
  });

  test('all votes for the same place accumulate', () => {
    expect(computeVoteCounts([
      { place_id: 'p' }, { place_id: 'p' }, { place_id: 'p' },
    ])).toEqual({ p: 3 });
  });
});

// ─── CastVoteSchema validation ─────────────────────────────────────────────────
// useCastVote calls CastVoteSchema.parse(input) before any DB write.

describe('CastVoteSchema', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';
  const otherUUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

  test('rejects non-UUID ping_id', () => {
    expect(() => CastVoteSchema.parse({ ping_id: 'not-a-uuid', place_id: validUUID }))
      .toThrow();
  });

  test('rejects empty place_id', () => {
    expect(() => CastVoteSchema.parse({ ping_id: validUUID, place_id: '' }))
      .toThrow();
  });

  test('rejects non-UUID place_id', () => {
    expect(() => CastVoteSchema.parse({ ping_id: validUUID, place_id: 'bad' }))
      .toThrow();
  });

  test('accepts two valid UUIDs', () => {
    expect(() => CastVoteSchema.parse({ ping_id: validUUID, place_id: otherUUID }))
      .not.toThrow();
  });
});
