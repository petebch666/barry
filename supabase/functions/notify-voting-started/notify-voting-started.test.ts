/**
 * Unit tests for notify-voting-started business logic.
 * Run with: deno test supabase/functions/notify-voting-started/notify-voting-started.test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// ─── Extracted pure functions (mirrored from index.ts for unit testing) ────────

function shouldNotify(record: { status: string }): boolean {
  return record.status === 'voting';
}

// ─── Tests ────────────────────────────────────────────────────────────────────

Deno.test('shouldNotify — voting status triggers notification', () => {
  assertEquals(shouldNotify({ status: 'voting' }), true);
});

Deno.test('shouldNotify — open status does not trigger', () => {
  assertEquals(shouldNotify({ status: 'open' }), false);
});

Deno.test('shouldNotify — confirmed status does not trigger', () => {
  assertEquals(shouldNotify({ status: 'confirmed' }), false);
});

Deno.test('shouldNotify — cancelled status does not trigger', () => {
  assertEquals(shouldNotify({ status: 'cancelled' }), false);
});

Deno.test('shouldNotify — unexpected status does not trigger', () => {
  assertEquals(shouldNotify({ status: 'unknown' }), false);
});
