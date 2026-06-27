/**
 * Triggered via DB Webhook on INSERT or UPDATE of votes.
 *
 * Majority rule: >50% of "in" RSVPs must vote for the same place.
 * Tie-break: place closest to the barycenter of "in" members with location wins.
 *
 * On confirmation:
 * - Updates pings.status = 'confirmed', confirmed_place_id = winner
 * - Sends push notification to all "in" members
 */
import { createServiceClient } from '../_shared/supabase-client.ts';

interface LatLng { latitude: number; longitude: number; }

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.latitude))*Math.cos(toRad(b.latitude))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
}

function computeBarycenter(points: LatLng[]): LatLng | null {
  if (!points.length) return null;
  let latSum = 0, lngSum = 0;
  for (const p of points) { latSum += p.latitude; lngSum += p.longitude; }
  return { latitude: latSum / points.length, longitude: lngSum / points.length };
}

Deno.serve(async (req) => {
  try {
    const { record } = await req.json();
    const pingId = record?.ping_id as string;
    if (!pingId) return Response.json({ skipped: 'no_ping_id' });

    const supabase = createServiceClient();

    // Bail early if ping is already in a terminal state
    const { data: ping } = await supabase
      .from('pings')
      .select('status, group_id')
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

    const maxVotes = Math.max(...Object.values(voteCounts));

    // Check majority threshold: strictly more than 50% of "in" members
    if (maxVotes / totalIn <= 0.5) {
      return Response.json({ status: 'no_majority_yet', maxVotes, totalIn });
    }

    // Find all places tied at maxVotes
    const leadingPlaceIds = Object.entries(voteCounts)
      .filter(([, count]) => count === maxVotes)
      .map(([id]) => id);

    let winnerId: string;

    if (leadingPlaceIds.length === 1) {
      winnerId = leadingPlaceIds[0];
    } else {
      // Tie-break: pick the place closest to the barycenter of "in" members with location
      const pointsWithLocation = (inRsvps ?? []).filter(
        (r: { latitude: number | null }) => r.latitude != null,
      ) as LatLng[];

      const barycenter = computeBarycenter(pointsWithLocation);

      if (!barycenter) {
        // No location data — fall back to the first place alphabetically (deterministic)
        winnerId = leadingPlaceIds.sort()[0];
      } else {
        const { data: tiedPlaces } = await supabase
          .from('places')
          .select('id, latitude, longitude')
          .in('id', leadingPlaceIds);

        winnerId = (tiedPlaces ?? []).reduce(
          (closest: { id: string; dist: number }, place: { id: string; latitude: number; longitude: number }) => {
            const dist = haversineMeters(barycenter, { latitude: place.latitude, longitude: place.longitude });
            return dist < closest.dist ? { id: place.id, dist } : closest;
          },
          { id: leadingPlaceIds[0], dist: Infinity },
        ).id;
      }
    }

    // Confirm the ping
    const { error: updateError } = await supabase
      .from('pings')
      .update({ status: 'confirmed', confirmed_place_id: winnerId })
      .eq('id', pingId);

    if (updateError) throw updateError;

    // Fetch winning place details for the notification
    const { data: winningPlace } = await supabase
      .from('places')
      .select('name, address')
      .eq('id', winnerId)
      .single();

    // Push notification to all "in" members
    const userIds = (inRsvps ?? []).map((r: { user_id: string }) => r.user_id);
    const { data: tokenRows } = await supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', userIds);

    const tokens = (tokenRows ?? []).map((r: { token: string }) => r.token);

    if (tokens.length) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          tokens,
          title: `Meetup confirmed! 🎉`,
          body: winningPlace
            ? `Meet at ${winningPlace.name}${winningPlace.address ? ` — ${winningPlace.address}` : ''}`
            : 'Your meetup has been confirmed!',
          data: { pingId, type: 'meetup_confirmed', place_id: winnerId },
        }),
      });
    }

    return Response.json({ confirmed: true, winner: winnerId, votes: maxVotes, totalIn });
  } catch (err) {
    console.error('check-vote-majority error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
