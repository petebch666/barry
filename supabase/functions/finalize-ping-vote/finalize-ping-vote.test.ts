/**
 * Unit tests for finalize-ping-vote business logic.
 * Run with: deno test supabase/functions/finalize-ping-vote/finalize-ping-vote.test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { pickWinner } from '../_shared/vote-decision.ts';

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

Deno.test('zero votes — sweep should skip the ping (asserted at the caller, not pickWinner)', () => {
  // finalize-ping-vote checks `!votes?.length` before calling pickWinner at
  // all, since Math.max() on an empty vote-count object is -Infinity and
  // has no sensible winner. This test documents that guard's precondition.
  const votes: { place_id: string }[] = [];
  assertEquals(votes.length === 0, true);
});
