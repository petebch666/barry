/**
 * Triggered via DB Webhook on INSERT or UPDATE of votes.
 *
 * No timer set (voting_deadline IS NULL): unchanged behavior — confirms as
 * soon as any place has a strict majority (>50% of "in" RSVPs).
 *
 * Timer set (voting_deadline IS NOT NULL): the majority short-circuit is
 * suppressed so a couple of early voters can't lock out the rest of the
 * group. Only two things can finalize early:
 *   - Every "in" member has voted (100% participation) — no one is left
 *     waiting, so there's no reason to hold the timer out further.
 *   - The deadline has already passed by the time this webhook fires (e.g.
 *     a vote lands right at the boundary) — finalize now instead of
 *     waiting for the next finalize-ping-vote cron tick.
 * Otherwise the ping stays in 'voting' and finalize-ping-vote's scheduled
 * sweep picks it up once the deadline passes.
 */
import { createServiceClient } from '../_shared/supabase-client.ts';
import { computeBarycenter, confirmWinner, hasMajority, pickWinner, shouldFinalizeVote, type LatLng } from '../_shared/vote-decision.ts';

Deno.serve(async (req) => {
  try {
    const { record } = await req.json();
    const pingId = record?.ping_id as string;
    if (!pingId) return Response.json({ skipped: 'no_ping_id' });

    const supabase = createServiceClient();

    // Bail early if ping is already in a terminal state
    const { data: ping } = await supabase
      .from('pings')
      .select('status, group_id, voting_deadline')
      .eq('id', pingId)
      .single();

    if (!ping || ping.status !== 'voting') {
      return Response.json({ skipped: 'ping_not_in_voting_state' });
    }

    // Count "in" RSVPs
    const { data: inRsvps } = await supabase
      .from('rsvps')
      .select('user_id, latitude, longitude')
      .eq('ping_id', pingId)
      .eq('status', 'in');

    const totalIn = inRsvps?.length ?? 0;
    if (totalIn === 0) return Response.json({ skipped: 'no_in_rsvps' });

    // Count votes per place
    const { data: votes } = await supabase
      .from('votes')
      .select('place_id')
      .eq('ping_id', pingId);

    if (!votes?.length) return Response.json({ skipped: 'no_votes' });

    const voteCounts = votes.reduce<Record<string, number>>((acc, v) => {
      acc[v.place_id] = (acc[v.place_id] ?? 0) + 1;
      return acc;
    }, {});

    const votingDeadline = ping.voting_deadline ? new Date(ping.voting_deadline) : null;

    const shouldFinalize = shouldFinalizeVote({
      hasTimer: votingDeadline != null,
      deadlinePassed: votingDeadline != null && votingDeadline.getTime() <= Date.now(),
      fullParticipation: votes.length === totalIn,
      hasMajority: hasMajority(voteCounts, totalIn),
    });

    const maxVotes = Math.max(...Object.values(voteCounts));

    if (!shouldFinalize) {
      return Response.json({ status: 'not_finalized_yet', maxVotes, totalIn });
    }

    // Tie-break needs the barycenter of "in" members with location
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

    if (!confirmed) return Response.json({ skipped: 'already_confirmed' });

    return Response.json({ confirmed: true, winner: winnerId, totalIn });
  } catch (err) {
    console.error('check-vote-majority error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
