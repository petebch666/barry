/**
 * Unit tests for finalize-ping-vote business logic.
 * Run with: deno test supabase/functions/finalize-ping-vote/finalize-ping-vote.test.ts
 */
import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { cancelUnvotedPing, pickWinner } from '../_shared/vote-decision.ts';

// finalize-ping-vote always decides via plurality (pickWinner) once a ping's
// deadline has passed — no >50% majority gate, since the timer's purpose is
// to force a decision. These tests confirm plurality-without-majority wins,
// reusing the same tie-break logic as check-vote-majority.

Deno.test('plurality — leader with less than 50% still wins at deadline', () => {
  // 2 of 5 "in" members voted for place-a — not a majority, but it's the
  // plurality leader and the deadline has passed, so it should win.
  const counts = { 'place-a': 2, 'place-b': 1 };
  const winner = pickWinner(counts, [], null);
  assertEquals(winner, 'place-a');
});

Deno.test('plurality — tie-break via barycenter reused from check-vote-majority', () => {
  const barycenter = { latitude: 48.8601, longitude: 2.3477 };
  const counts = { 'near': 1, 'far': 1 };
  const places = [
    { id: 'near', latitude: 48.861, longitude: 2.348 },
    { id: 'far', latitude: 48.876, longitude: 2.331 },
  ];
  const winner = pickWinner(counts, places, barycenter);
  assertEquals(winner, 'near');
});

// Zero votes never reach pickWinner (Math.max() of nothing is -Infinity);
// the sweep cancels the ping instead.
type Call = [string, ...unknown[]];
function fakeClient(result: { data: { id: string }[] | null; error: Error | null }) {
  const calls: Call[] = [];
  const query = {
    update(values: unknown) { calls.push(['update', values]); return query; },
    eq(column: string, value: unknown) { calls.push(['eq', column, value]); return query; },
    select(columns: string) { calls.push(['select', columns]); return Promise.resolve(result); },
  };
  const client = { from(table: string) { calls.push(['from', table]); return query; } };
  return { client: client as unknown as Parameters<typeof cancelUnvotedPing>[0], calls };
}

Deno.test('zero votes — cancels the ping, guarded on status = voting', async () => {
  const { client, calls } = fakeClient({ data: [{ id: 'ping-1' }], error: null });
  const { cancelled } = await cancelUnvotedPing(client, 'ping-1');
  assertEquals(cancelled, true);
  assertEquals(calls, [
    ['from', 'pings'],
    ['update', { status: 'cancelled' }],
    ['eq', 'id', 'ping-1'],
    ['eq', 'status', 'voting'],
    ['select', 'id'],
  ]);
});

Deno.test('zero votes — no-op when a late vote already confirmed the ping', async () => {
  const { client } = fakeClient({ data: [], error: null });
  const { cancelled } = await cancelUnvotedPing(client, 'ping-1');
  assertEquals(cancelled, false);
});

Deno.test('zero votes — surfaces a database error instead of reporting success', async () => {
  const { client } = fakeClient({ data: null, error: new Error('db down') });
  await assertRejects(() => cancelUnvotedPing(client, 'ping-1'), Error, 'db down');
});
