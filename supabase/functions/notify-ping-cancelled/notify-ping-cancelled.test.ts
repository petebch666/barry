/**
 * Unit tests for notify-ping-cancelled business logic.
 * Run with: deno test supabase/functions/notify-ping-cancelled/notify-ping-cancelled.test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// ─── Extracted pure functions (mirrored from index.ts for unit testing) ────────

function shouldNotify(
  record: { status: string },
  old_record?: { status: string },
): boolean {
  return record.status === 'cancelled' && old_record?.status !== 'cancelled';
}

function buildNotificationBody(message: string): string {
  return `"${message.slice(0, 80)}" has been cancelled.`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

Deno.test('shouldNotify — open → cancelled triggers notification', () => {
  assertEquals(shouldNotify({ status: 'cancelled' }, { status: 'open' }), true);
});

Deno.test('shouldNotify — voting → cancelled triggers notification', () => {
  assertEquals(shouldNotify({ status: 'cancelled' }, { status: 'voting' }), true);
});

Deno.test('shouldNotify — already cancelled does not re-trigger', () => {
  assertEquals(shouldNotify({ status: 'cancelled' }, { status: 'cancelled' }), false);
});

Deno.test('shouldNotify — confirmed ping change is skipped', () => {
  assertEquals(shouldNotify({ status: 'confirmed' }, { status: 'voting' }), false);
});

Deno.test('shouldNotify — missing old_record still triggers (first cancel event)', () => {
  assertEquals(shouldNotify({ status: 'cancelled' }, undefined), true);
});

Deno.test('buildNotificationBody — short message is quoted verbatim', () => {
  const body = buildNotificationBody('Anyone for drinks tonight?');
  assertEquals(body, '"Anyone for drinks tonight?" has been cancelled.');
});

Deno.test('buildNotificationBody — message over 80 chars is truncated at 80', () => {
  const longMsg = 'A'.repeat(90);
  const body = buildNotificationBody(longMsg);
  assertEquals(body, `"${'A'.repeat(80)}" has been cancelled.`);
});

Deno.test('buildNotificationBody — message exactly 80 chars is not truncated', () => {
  const msg = 'B'.repeat(80);
  const body = buildNotificationBody(msg);
  assertEquals(body, `"${'B'.repeat(80)}" has been cancelled.`);
});
