/**
 * Unit tests for send-push-notification business logic.
 * Run with: deno test supabase/functions/send-push-notification/send-push-notification.test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// ─── Extracted pure functions (mirrored from index.ts for unit testing) ────────

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: string;
}

interface PushPayload {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const BATCH_SIZE = 100;

function buildBatches(payload: PushPayload): PushMessage[][] {
  const batches: PushMessage[][] = [];
  for (let i = 0; i < payload.tokens.length; i += BATCH_SIZE) {
    const batch = payload.tokens.slice(i, i + BATCH_SIZE).map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: 'default',
    }));
    batches.push(batch);
  }
  return batches;
}

// ─── Tests — empty / no-op ────────────────────────────────────────────────────

Deno.test('buildBatches — empty token list produces no batches', () => {
  const batches = buildBatches({ tokens: [], title: 'Hi', body: 'Test' });
  assertEquals(batches.length, 0);
});

// ─── Tests — single batch ─────────────────────────────────────────────────────

Deno.test('buildBatches — 1 token produces 1 batch of 1', () => {
  const batches = buildBatches({ tokens: ['tok-a'], title: 'T', body: 'B' });
  assertEquals(batches.length, 1);
  assertEquals(batches[0].length, 1);
  assertEquals(batches[0][0].to, 'tok-a');
});

Deno.test('buildBatches — exactly 100 tokens produces 1 batch', () => {
  const tokens = Array.from({ length: 100 }, (_, i) => `tok-${i}`);
  const batches = buildBatches({ tokens, title: 'T', body: 'B' });
  assertEquals(batches.length, 1);
  assertEquals(batches[0].length, 100);
});

// ─── Tests — multiple batches ─────────────────────────────────────────────────

Deno.test('buildBatches — 101 tokens splits into 2 batches (100 + 1)', () => {
  const tokens = Array.from({ length: 101 }, (_, i) => `tok-${i}`);
  const batches = buildBatches({ tokens, title: 'T', body: 'B' });
  assertEquals(batches.length, 2);
  assertEquals(batches[0].length, 100);
  assertEquals(batches[1].length, 1);
});

Deno.test('buildBatches — 200 tokens splits into 2 batches of 100', () => {
  const tokens = Array.from({ length: 200 }, (_, i) => `tok-${i}`);
  const batches = buildBatches({ tokens, title: 'T', body: 'B' });
  assertEquals(batches.length, 2);
  assertEquals(batches[0].length, 100);
  assertEquals(batches[1].length, 100);
});

Deno.test('buildBatches — 201 tokens splits into 3 batches', () => {
  const tokens = Array.from({ length: 201 }, (_, i) => `tok-${i}`);
  const batches = buildBatches({ tokens, title: 'T', body: 'B' });
  assertEquals(batches.length, 3);
  assertEquals(batches[2].length, 1);
});

// ─── Tests — message fields ───────────────────────────────────────────────────

Deno.test('buildBatches — each message carries correct fields', () => {
  const batches = buildBatches({
    tokens: ['tok-1'],
    title: 'Meetup confirmed',
    body: 'See you at Le Marais!',
    data: { pingId: 'ping-abc', type: 'confirmed' },
  });
  const msg = batches[0][0];
  assertEquals(msg.to, 'tok-1');
  assertEquals(msg.title, 'Meetup confirmed');
  assertEquals(msg.body, 'See you at Le Marais!');
  assertEquals(msg.data, { pingId: 'ping-abc', type: 'confirmed' });
  assertEquals(msg.sound, 'default');
});

Deno.test('buildBatches — missing data field defaults to empty object', () => {
  const batches = buildBatches({ tokens: ['tok-1'], title: 'T', body: 'B' });
  assertEquals(batches[0][0].data, {});
});
