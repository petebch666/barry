/**
 * Triggered by the notify_pinger triggers (025) on INSERT of rsvps and on
 * UPDATE of rsvps.status. Tells the ping's creator who answered and how, and
 * once everyone else in the group has answered.
 */
import { createServiceClient } from '../_shared/supabase-client.ts';
import { forbidden, isServiceCall } from '../_shared/auth.ts';
import { buildPingerMessage, type RsvpStatus } from './message.ts';

Deno.serve(async (req) => {
  if (!(await isServiceCall(req))) return forbidden();

  try {
    const { record, old_record } = await req.json() as {
      record: { ping_id: string; user_id: string; status: RsvpStatus };
      old_record: { status: RsvpStatus } | null;
    };
    const previousStatus = old_record?.status ?? null;
    if (previousStatus === record.status) return Response.json({ skipped: 'status_unchanged' });

    const supabase = createServiceClient();

    const { data: ping } = await supabase
      .from('pings')
      .select('id, group_id, created_by, message, status')
      .eq('id', record.ping_id)
      .single();
    if (!ping || !ping.created_by) return Response.json({ skipped: 'no_pinger' });
    if (ping.status === 'confirmed' || ping.status === 'cancelled') return Response.json({ skipped: 'ping_terminal' });
    if (ping.created_by === record.user_id) return Response.json({ skipped: 'pinger_answered' });

    const [{ data: profile }, { data: answers }, { count: members }, { data: tokenRows }] = await Promise.all([
      supabase.from('profiles').select('display_name').eq('id', record.user_id).single(),
      supabase.from('rsvps').select('status').eq('ping_id', ping.id).neq('user_id', ping.created_by),
      supabase.from('group_members').select('user_id', { count: 'exact', head: true }).eq('group_id', ping.group_id),
      supabase.from('push_tokens').select('token').eq('user_id', ping.created_by),
    ]);

    const tokens = (tokenRows ?? []).map((t: { token: string }) => t.token);
    if (!tokens.length) return Response.json({ sent: 0 });

    const counts: Record<RsvpStatus, number> = { in: 0, maybe: 0, out: 0 };
    for (const a of answers ?? []) counts[a.status as RsvpStatus] += 1;

    const message = buildPingerMessage({
      name: profile?.display_name ?? 'Someone',
      status: record.status,
      previousStatus,
      pingMessage: ping.message,
      counts,
      othersInGroup: Math.max((members ?? 0) - 1, 0),
    });
    if (!message) return Response.json({ skipped: 'nothing_to_say' });

    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ tokens, ...message, data: { pingId: ping.id, type: 'rsvp_update' } }),
    });
    return Response.json({ sent: tokens.length, push_status: res.status });
  } catch (err) {
    console.error('notify-pinger error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
