/**
 * Unit tests for check-vote-majority business logic.
 * Run with: deno test supabase/functions/check-vote-majority/check-vote-majority.test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { computeBarycenter, hasMajority, pickWinner, shouldFinalizeVote } from '../_shared/vote-decision.ts';

// ─── Majority / winner tests (unchanged behavior) ─────────────────────────────

Deno.test('majority — 3 of 5 votes (>50%) triggers confirmation', () => {
  const counts = { 'place-a': 3, 'place-b': 2 };
  assertEquals(hasMajority(counts, 5), true);
});

Deno.test('majority — exactly 50% does NOT trigger confirmation', () => {
  const counts = { 'place-a': 2, 'place-b': 2 };
  assertEquals(hasMajority(counts, 4), false);
});

Deno.test('majority — 2 of 3 votes (>50%) triggers confirmation', () => {
  const counts = { 'place-a': 2, 'place-b': 1 };
  assertEquals(hasMajority(counts, 3), true);
});

Deno.test('majority — 1 of 2 votes does NOT trigger (50%)', () => {
  const counts = { 'place-a': 1, 'place-b': 1 };
  assertEquals(hasMajority(counts, 2), false);
});

Deno.test('winner — clear leader is picked', () => {
  const counts = { 'place-a': 4, 'place-b': 1 };
  const winner = pickWinner(counts, [], null);
  assertEquals(winner, 'place-a');
});

Deno.test('tie-break — closest place to barycenter wins', () => {
  // Barycenter at Châtelet, Paris
  const barycenter = { latitude: 48.8601, longitude: 2.3477 };
  const counts = { 'near': 3, 'far': 3 };
  const places = [
    { id: 'near', latitude: 48.861, longitude: 2.348 }, // ~130 m from barycenter
    { id: 'far',  latitude: 48.876, longitude: 2.331 }, // ~2 km from barycenter
  ];
  const winner = pickWinner(counts, places, barycenter);
  assertEquals(winner, 'near');
});

Deno.test('tie-break — no location data falls back to alphabetical sort', () => {
  const counts = { 'place-b': 2, 'place-a': 2 };
  const winner = pickWinner(counts, [], null);
  assertEquals(winner, 'place-a');
});

Deno.test('barycenter — returns null for empty array', () => {
  assertEquals(computeBarycenter([]), null);
});

Deno.test('barycenter — midpoint of two symmetric points', () => {
  const result = computeBarycenter([
    { latitude: 48.0, longitude: 2.0 },
    { latitude: 50.0, longitude: 4.0 },
  ]);
  assertEquals(result?.latitude.toFixed(4), '49.0000');
  assertEquals(result?.longitude.toFixed(4), '3.0000');
});

// ─── Timer branching (shouldFinalizeVote) ──────────────────────────────────────

Deno.test('shouldFinalizeVote — no timer, majority reached → finalizes (unchanged behavior)', () => {
  const result = shouldFinalizeVote({
    hasTimer: false,
    deadlinePassed: false,
    fullParticipation: false,
    hasMajority: true,
  });
  assertEquals(result, true);
});

Deno.test('shouldFinalizeVote — no timer, no majority → does not finalize', () => {
  const result = shouldFinalizeVote({
    hasTimer: false,
    deadlinePassed: false,
    fullParticipation: false,
    hasMajority: false,
  });
  assertEquals(result, false);
});

Deno.test('shouldFinalizeVote — timer active, 2/3 majority but not everyone voted → does NOT finalize (the bug being fixed)', () => {
  const result = shouldFinalizeVote({
    hasTimer: true,
    deadlinePassed: false,
    fullParticipation: false,
    hasMajority: true,
  });
  assertEquals(result, false);
});

Deno.test('shouldFinalizeVote — timer active, 100% participation → finalizes even without a >50% margin change', () => {
  const result = shouldFinalizeVote({
    hasTimer: true,
    deadlinePassed: false,
    fullParticipation: true,
    hasMajority: true,
  });
  assertEquals(result, true);
});

Deno.test('shouldFinalizeVote — timer active, deadline already passed → finalizes with whatever votes exist', () => {
  const result = shouldFinalizeVote({
    hasTimer: true,
    deadlinePassed: true,
    fullParticipation: false,
    hasMajority: false,
  });
  assertEquals(result, true);
});

Deno.test('shouldFinalizeVote — timer active, deadline not passed, partial participation, no majority → does not finalize', () => {
  const result = shouldFinalizeVote({
    hasTimer: true,
    deadlinePassed: false,
    fullParticipation: false,
    hasMajority: false,
  });
  assertEquals(result, false);
});
