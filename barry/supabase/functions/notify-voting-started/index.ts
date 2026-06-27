/**
 * Triggered via DB Webhook on UPDATE of pings WHERE status = 'voting'.
 * Notifies all "in" RSVPs that place suggestions are ready to vote on.
 */
import { createServiceClient } from '../_shared/supabase-client.ts';

Deno.serve(async (req) => {
  try {
    const { record } = await req.json();
    const { id: pingId, status, message } = record as {
      id: string; status: string; message: string;
    };

    if (status !== 'voting') return Response.json({ skipped: true });

    const supabase = createServiceClient();

    // Get push tokens for all "in" RSVPs
    const { data: inRsvps } = await supabase
      .from('rsvps')
      .select('user_id')
      .eq('ping_id', pingId)
      .eq('status', 'in');

    if (!inRsvps?.length) return Response.json({ sent: 0 });

    const userIds = inRsvps.map((r: { user_id: string }) => r.user_id);
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
        title: 'Places are ready — vote now!',
        body: message,
        data: { pingId, type: 'voting_started' },
      }),
    });

    const result = await res.json();
    return Response.json(result);
  } catch (err) {
    console.error('notify-voting-started error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
