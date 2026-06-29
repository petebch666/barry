/**
 * Triggered via DB Webhook on INSERT into pings.
 * Fans out a push notification to all group members except the creator.
 */
import { createServiceClient } from '../_shared/supabase-client.ts';

Deno.serve(async (req) => {
  try {
    const { record } = await req.json();
    // record is the newly inserted pings row
    const { id: pingId, group_id, created_by, message } = record as {
      id: string;
      group_id: string;
      created_by: string;
      message: string;
    };

    const supabase = createServiceClient();

    // Fetch group name
    const { data: group } = await supabase
      .from('groups')
      .select('name')
      .eq('id', group_id)
      .single();

    // Fetch creator display name
    const { data: creator } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', created_by)
      .single();

    // Fetch push tokens for all group members except the creator
    const { data: members } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', group_id)
      .neq('user_id', created_by);

    if (!members?.length) return Response.json({ sent: 0 });

    const userIds = members.map((m: { user_id: string }) => m.user_id);
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
        title: `${group?.name ?? 'Barry'} — ${creator?.display_name ?? 'Someone'} is available`,
        body: message,
        data: { pingId, type: 'new_ping' },
      }),
    });

    const result = await res.json();
    return Response.json(result);
  } catch (err) {
    console.error('notify-group-on-ping error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
