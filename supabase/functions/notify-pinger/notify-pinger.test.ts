import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildPingerMessage, type PingerUpdate } from './message.ts';

const base: PingerUpdate = {
  name: 'Alice',
  status: 'in',
  previousStatus: null,
  pingMessage: 'Drinks tonight?',
  counts: { in: 1, maybe: 0, out: 0 },
  othersInGroup: 3,
};

Deno.test('first answer — tells the pinger who is in', () => {
  assertEquals(buildPingerMessage(base), { title: '“Drinks tonight?”', body: 'Alice is in.' });
});

Deno.test('the answer that completes the round adds the tally', () => {
  const m = buildPingerMessage({ ...base, counts: { in: 2, maybe: 0, out: 1 }, othersInGroup: 3, status: 'out' });
  assertEquals(m?.body, "Alice can't make it. Everyone has answered: 2 in, 0 maybe, 1 out.");
});

Deno.test('two-person group: the only other member answering completes it', () => {
  const m = buildPingerMessage({ ...base, othersInGroup: 1 });
  assertEquals(m?.body, 'Alice is in. Everyone has answered: 1 in, 0 maybe, 0 out.');
});

Deno.test('leaving after being in', () => {
  const m = buildPingerMessage({ ...base, status: 'out', previousStatus: 'in', counts: { in: 0, maybe: 0, out: 1 }, othersInGroup: 1 });
  assertEquals(m?.body, "Alice can't make it anymore.");
});

Deno.test('coming back after leaving', () => {
  const m = buildPingerMessage({ ...base, status: 'in', previousStatus: 'out' });
  assertEquals(m?.body, 'Alice is in after all.');
});

Deno.test('in to maybe', () => {
  assertEquals(buildPingerMessage({ ...base, status: 'maybe', previousStatus: 'in' })?.body, 'Alice is now a maybe.');
});

Deno.test('a change of answer never repeats the tally', () => {
  const m = buildPingerMessage({ ...base, status: 'maybe', previousStatus: 'out', counts: { in: 1, maybe: 1, out: 1 } });
  assertEquals(m?.body, 'Alice might come.');
});

Deno.test('no change — nothing to send', () => {
  assertEquals(buildPingerMessage({ ...base, previousStatus: 'in' }), null);
});

Deno.test('long ping messages are shortened in the title', () => {
  const m = buildPingerMessage({ ...base, pingMessage: 'x'.repeat(60) });
  assertEquals(m?.title, `“${'x'.repeat(39)}…”`);
});
