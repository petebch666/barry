import { CreatePingSchema } from '@/schemas';

// ─── CreatePingSchema validation ──────────────────────────────────────────────
// useCreatePing calls CreatePingSchema.parse(input) before any DB write,
// so these schema tests guarantee the hook rejects invalid data at the boundary.

describe('CreatePingSchema', () => {
  const validGroupId = '550e8400-e29b-41d4-a716-446655440000';

  test('rejects empty message', () => {
    expect(() => CreatePingSchema.parse({ group_id: validGroupId, message: '' }))
      .toThrow();
  });

  test('rejects message over 500 characters', () => {
    expect(() => CreatePingSchema.parse({ group_id: validGroupId, message: 'x'.repeat(501) }))
      .toThrow();
  });

  test('rejects non-UUID group_id', () => {
    expect(() => CreatePingSchema.parse({ group_id: 'not-a-uuid', message: 'Anyone free tonight?' }))
      .toThrow();
  });

  test('accepts valid ping at minimum length', () => {
    expect(() => CreatePingSchema.parse({ group_id: validGroupId, message: 'x' }))
      .not.toThrow();
  });

  test('accepts valid ping at max length', () => {
    expect(() => CreatePingSchema.parse({ group_id: validGroupId, message: 'x'.repeat(500) }))
      .not.toThrow();
  });

  test('accepts optional proposed_time as ISO datetime', () => {
    expect(() => CreatePingSchema.parse({
      group_id: validGroupId,
      message: 'Drinks?',
      proposed_time: '2026-07-01T20:00:00.000Z',
    })).not.toThrow();
  });

  test('rejects malformed proposed_time', () => {
    expect(() => CreatePingSchema.parse({
      group_id: validGroupId,
      message: 'Drinks?',
      proposed_time: 'tonight',
    })).toThrow();
  });

  test('accepts valid vote_timer_minutes', () => {
    expect(() => CreatePingSchema.parse({
      group_id: validGroupId,
      message: 'Drinks?',
      vote_timer_minutes: 30,
    })).not.toThrow();
  });

  test('accepts null vote_timer_minutes (no timer)', () => {
    expect(() => CreatePingSchema.parse({
      group_id: validGroupId,
      message: 'Drinks?',
      vote_timer_minutes: null,
    })).not.toThrow();
  });

  test('accepts omitted vote_timer_minutes', () => {
    expect(() => CreatePingSchema.parse({ group_id: validGroupId, message: 'Drinks?' }))
      .not.toThrow();
  });

  test('rejects zero vote_timer_minutes', () => {
    expect(() => CreatePingSchema.parse({
      group_id: validGroupId,
      message: 'Drinks?',
      vote_timer_minutes: 0,
    })).toThrow();
  });

  test('rejects negative vote_timer_minutes', () => {
    expect(() => CreatePingSchema.parse({
      group_id: validGroupId,
      message: 'Drinks?',
      vote_timer_minutes: -15,
    })).toThrow();
  });

  test('rejects non-integer vote_timer_minutes', () => {
    expect(() => CreatePingSchema.parse({
      group_id: validGroupId,
      message: 'Drinks?',
      vote_timer_minutes: 15.5,
    })).toThrow();
  });
});
