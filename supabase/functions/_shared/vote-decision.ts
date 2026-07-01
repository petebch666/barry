// Shared place-decision logic used by both check-vote-majority (fires per
// vote) and finalize-ping-vote (fires per minute, sweeping expired vote
// timers). Keeping this in one module means both callers agree on how a
// winner is picked and how a ping gets confirmed.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface LatLng { latitude: number; longitude: number; }

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.latitude))*Math.cos(toRad(b.latitude))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
}

export function computeBarycenter(points: LatLng[]): LatLng | null {
  if (!points.length) return null;
  let latSum = 0, lngSum = 0;
  for (const p of points) { latSum += p.latitude; lngSum += p.longitude; }
  return { latitude: latSum / points.length, longitude: lngSum / points.length };
}

export function hasMajority(voteCounts: Record<string, number>, totalIn: number): boolean {
  if (totalIn === 0) return false;
  const max = Math.max(...Object.values(voteCounts));
  return max / totalIn > 0.5;
}

/**
 * Whether check-vote-majority should finalize right now, given whether the
 * ping has a vote timer set:
 *   - no timer: unchanged strict-majority behavior.
 *   - timer, deadline already passed: finalize immediately (whatever votes exist).
 *   - timer, deadline still ahead: only if every "in" member has voted.
 */
export function shouldFinalizeVote(params: {
  hasTimer: boolean;
  deadlinePassed: boolean;
  fullParticipation: boolean;
  hasMajority: boolean;
}): boolean {
  const { hasTimer, deadlinePassed, fullParticipation, hasMajority } = params;
  if (!hasTimer) return hasMajority;
  if (deadlinePassed) return true;
  return fullParticipation;
}

/** Highest vote count wins; ties break to the place closest to the barycenter. */
export function pickWinner(
  voteCounts: Record<string, number>,
  places: { id: string; latitude: number; longitude: number }[],
  barycenter: LatLng | null,
): string {
  const maxVotes = Math.max(...Object.values(voteCounts));
  const tied = Object.entries(voteCounts).filter(([, c]) => c === maxVotes).map(([id]) => id);
  if (tied.length === 1) return tied[0];
  if (!barycenter) return tied.sort()[0];
  return places
    .filter((p) => tied.includes(p.id))
    .reduce(
      (closest, place) => {
        const dist = haversineMeters(barycenter, place);
        return dist < closest.dist ? { id: place.id, dist } : closest;
      },
      { id: tied[0], dist: Infinity },
    ).id;
}

/**
 * Confirms a ping's winning place and notifies "in" members.
 *
 * Race safety: this UPDATE is guarded by `WHERE status = 'voting'`. Two
 * callers can race here — check-vote-majority (webhook, per vote) and
 * finalize-ping-vote (cron, per minute) both observe status='voting' near a
 * timer's deadline. Postgres's row-level lock on this UPDATE ensures only
 * one caller's write applies; the other's WHERE clause matches zero rows,
 * `.select()` comes back empty, and `confirmed` is false below — that
 * caller must skip sending its own notification rather than treat this as
 * an error.
 */
export async function confirmWinner(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  pingId: string,
  winnerId: string,
  inUserIds: string[],
): Promise<{ confirmed: boolean }> {
  const { data: updated, error: updateError } = await supabase
    .from('pings')
    .update({ status: 'confirmed', confirmed_place_id: winnerId })
    .eq('id', pingId)
    .eq('status', 'voting')
    .select('id');

  if (updateError) throw updateError;
  if (!updated?.length) return { confirmed: false };

  const { data: winningPlace } = await supabase
    .from('places')
    .select('name, address')
    .eq('id', winnerId)
    .single();

  const { data: tokenRows } = await supabase
    .from('push_tokens')
    .select('token')
    .in('user_id', inUserIds);

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

  return { confirmed: true };
}
