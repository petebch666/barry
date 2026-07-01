/**
 * Invoked on a schedule (pg_cron + pg_net, every minute — see
 * supabase/migrations/011_finalize_vote_cron.sql), not via a DB Webhook.
 *
 * Sweeps pings whose vote timer has expired and finalizes them: the
 * plurality leader wins (tie-break via barycenter), no >50% majority
 * required — the timer's whole purpose is to force a decision once time is
 * up. Pings with zero votes are left in 'voting' rather than auto-cancelled;
 * out of scope for this feature.
 */
import { createServiceClient } from '../_shared/supabase-client.ts';
import { computeBarycenter, confirmWinner, pickWinner, type LatLng } from '../_shared/vote-decision.ts';

Deno.serve(async (_req) => {
  try {
    const supabase = createServiceClient();

    const { data: expiredPings, error } = await supabase
      .from('pings')
      .select('id')
      .eq('status', 'voting')
      .not('voting_deadline', 'is', null)
      .lt('voting_deadline', new Date().toISOString());

    if (error) throw error;
    if (!expiredPings?.length) return Response.json({ processed: 0 });

    const results: Record<string, string> = {};

    for (const { id: pingId } of expiredPings) {
      const { data: inRsvps } = await supabase
        .from('rsvps')
        .select('user_id, latitude, longitude')
        .eq('ping_id', pingId)
        .eq('status', 'in');

      const { data: votes } = await supabase
        .from('votes')
        .select('place_id')
        .eq('ping_id', pingId);

      if (!votes?.length) {
        results[pingId] = 'skipped_no_votes';
        continue;
      }

      const voteCounts = votes.reduce<Record<string, number>>((acc, v) => {
        acc[v.place_id] = (acc[v.place_id] ?? 0) + 1;
        return acc;
      }, {});
      const maxVotes = Math.max(...Object.values(voteCounts));

      const pointsWithLocation = (inRsvps ?? []).filter(
        (r: { latitude: number | null }) => r.latitude != null,
      ) as LatLng[];
      const barycenter = computeBarycenter(pointsWithLocation);

      const tiedCandidateIds = Object.entries(voteCounts)
        .filter(([, count]) => count === maxVotes)
        .map(([id]) => id);

      const { data: tiedPlaces } = tiedCandidateIds.length > 1
        ? await supabase.from('places').select('id, latitude, longitude').in('id', tiedCandidateIds)
        : { data: [] };

      const winnerId = pickWinner(voteCounts, tiedPlaces ?? [], barycenter);
      const userIds = (inRsvps ?? []).map((r: { user_id: string }) => r.user_id);
      const { confirmed } = await confirmWinner(supabase, pingId, winnerId, userIds);

      results[pingId] = confirmed ? `confirmed:${winnerId}` : 'already_confirmed';
    }

    return Response.json({ processed: expiredPings.length, results });
  } catch (err) {
    console.error('finalize-ping-vote error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
