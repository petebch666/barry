/**
 * Unit tests for notify-group-on-ping business logic.
 * Run with: deno test supabase/functions/notify-group-on-ping/notify-group-on-ping.test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// ─── Extracted pure functions (mirrored from index.ts for unit testing) ────────

function buildNotificationTitle(
  groupName: string | null | undefined,
  creatorName: string | null | undefined,
): string {
  return `${groupName ?? 'Barry'} — ${creatorName ?? 'Someone'} is available`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

Deno.test('buildNotificationTitle — formats group and creator names', () => {
  assertEquals(
    buildNotificationTitle('Sunday Crew', 'Alice'),
    'Sunday Crew — Alice is available',
  );
});

Deno.test('buildNotificationTitle — null groupName falls back to Barry', () => {
  assertEquals(
    buildNotificationTitle(null, 'Bob'),
    'Barry — Bob is available',
  );
});

Deno.test('buildNotificationTitle — null creatorName falls back to Someone', () => {
  assertEquals(
    buildNotificationTitle('Weekend Gang', null),
    'Weekend Gang — Someone is available',
  );
});

Deno.test('buildNotificationTitle — both null use both fallbacks', () => {
  assertEquals(
    buildNotificationTitle(null, null),
    'Barry — Someone is available',
  );
});

Deno.test('buildNotificationTitle — undefined values use fallbacks', () => {
  assertEquals(
    buildNotificationTitle(undefined, undefined),
    'Barry — Someone is available',
  );
});
