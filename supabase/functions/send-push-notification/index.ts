/**
 * Internal push notification dispatcher.
 *
 * Called via HTTP POST from sibling Edge Functions — not exposed publicly.
 * Accepts up to 100 tokens per request (Expo Push API limit per batch).
 */

interface PushPayload {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

Deno.serve(async (req) => {
  try {
    const payload: PushPayload = await req.json();

    if (!Array.isArray(payload.tokens) || payload.tokens.length === 0) {
      return Response.json({ sent: 0 }, { status: 200 });
    }

    const allReceipts: unknown[] = [];

    // Fan out in batches of 100
    for (let i = 0; i < payload.tokens.length; i += BATCH_SIZE) {
      const batch = payload.tokens.slice(i, i + BATCH_SIZE).map((to) => ({
        to,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: 'default',
      }));

      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      });

      if (!res.ok) {
        console.error('Expo Push API error:', await res.text());
        continue;
      }

      const { data } = await res.json();
      allReceipts.push(...(data ?? []));
    }

    return Response.json({ sent: payload.tokens.length, receipts: allReceipts });
  } catch (err) {
    console.error('send-push-notification error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
