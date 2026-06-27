import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { CastVoteSchema, type Vote, type CastVote } from '@/schemas';

const QUERY_KEY = 'votes';

export function useVotes(pingId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, pingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('votes')
        .select('*')
        .eq('ping_id', pingId);

      if (error) throw error;
      return data as Vote[];
    },
    enabled: !!pingId,
  });
}

/** Subscribes to real-time vote changes — triggers when check-vote-majority may have fired. */
export function useVotesRealtime(pingId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!pingId) return;

    const channel = supabase
      .channel(`votes:${pingId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'votes', filter: `ping_id=eq.${pingId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: [QUERY_KEY, pingId] });
          // A vote may have triggered majority confirmation — re-fetch the ping too
          queryClient.invalidateQueries({ queryKey: ['pings', pingId] });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pingId, queryClient]);
}

export function useCastVote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CastVote) => {
      CastVoteSchema.parse(input);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upsert: replaces the previous vote if the user has already voted on this ping.
      // The UNIQUE(ping_id, user_id) constraint enforces one vote per user.
      const { error } = await supabase
        .from('votes')
        .upsert(
          { ping_id: input.ping_id, place_id: input.place_id, user_id: user.id },
          { onConflict: 'ping_id,user_id' },
        );

      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, input.ping_id] });
    },
  });
}

/** Returns the current user's vote for a ping, if any. */
export function useMyVote(pingId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, pingId, 'mine'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('votes')
        .select('place_id')
        .eq('ping_id', pingId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data?.place_id ?? null;
    },
    enabled: !!pingId,
  });
}

/** Returns vote counts per place for a ping, as a map { place_id → count }. */
export function useVoteCounts(pingId: string): Record<string, number> {
  const { data: votes = [] } = useVotes(pingId);
  return votes.reduce<Record<string, number>>((acc, v) => {
    acc[v.place_id] = (acc[v.place_id] ?? 0) + 1;
    return acc;
  }, {});
}
