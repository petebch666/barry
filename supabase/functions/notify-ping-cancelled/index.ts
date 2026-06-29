/**
 * Triggered via DB Webhook on UPDATE of pings.
 * When a ping transitions to 'cancelled', notifies all RSVP'd members
 * (any status, excluding the creator).
 */
import { createServiceClient } from '../_shared/supabase-client.ts';

Deno.serve(async (req) => {
  try {
    const { record, old_record } = await req.json();

    if (record.status !== 'cancelled' || old_record?.status === 'cancelled') {
      return Response.json({ skipped: true });
    }

    const { id: pingId, created_by, message } = record as {
      id: string; created_by: string; message: string;
    };

    const supabase = createServiceClient();

    const { data: rsvps } = await supabase
      .from('rsvps')
      .select('user_id')
      .eq('ping_id', pingId)
      .neq('user_id', created_by);

    if (!rsvps?.length) return Response.json({ sent: 0 });

    const userIds = rsvps.map((r: { user_id: string }) => r.user_id);
    const { data: tokenRows } = await supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', userIds);

    const tokens = (tokenRows ?? []).map((r: { token: string }) => r.token);
    if (!tokens.length) return Response.json({ sent: 0 });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const res = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        tokens,
        title: 'Ping cancelled',
        body: `"${message.slice(0, 80)}" has been cancelled.`,
        data: { pingId, type: 'ping_cancelled' },
      }),
    });

    const result = await res.json();
    return Response.json(result);
  } catch (err) {
    console.error('notify-ping-cancelled error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
