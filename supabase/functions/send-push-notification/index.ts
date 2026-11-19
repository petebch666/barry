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

import { createServiceClient } from '../_shared/supabase-client.ts';
import { summarizeTickets, type PushTicket } from './tickets.ts';
import { forbidden, isServiceCall } from '../_shared/auth.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

Deno.serve(async (req) => {
  if (!(await isServiceCall(req))) return forbidden();

  try {
    const payload: PushPayload = await req.json();

    if (!Array.isArray(payload.tokens) || payload.tokens.length === 0) {
      return Response.json({ sent: 0 }, { status: 200 });
    }

    let ok = 0;
    let failed = 0;
    const deadTokens: string[] = [];

    // Fan out in batches of 100
    for (let i = 0; i < payload.tokens.length; i += BATCH_SIZE) {
      const tokens = payload.tokens.slice(i, i + BATCH_SIZE);
      const batch = tokens.map((to) => ({
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
        console.error('Expo Push API error:', res.status, await res.text());
        failed += tokens.length;
        continue;
      }

      const { data } = await res.json() as { data?: PushTicket[] };
      const summary = summarizeTickets(tokens, data ?? []);
      ok += summary.ok;
      failed += summary.failed;
      deadTokens.push(...summary.deadTokens);
      // Log the error type only: a token is a device identifier.
      for (const e of summary.errors) console.error('Push ticket error:', e.error, e.message ?? '');
    }

    // Without this, every later notification keeps going to uninstalled apps.
    if (deadTokens.length) {
      const { error } = await createServiceClient().from('push_tokens').delete().in('token', deadTokens);
      if (error) console.error('Could not remove dead push tokens:', error.message);
    }

    return Response.json({ sent: ok, failed, removed_tokens: deadTokens.length });
  } catch (err) {
    console.error('send-push-notification error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
