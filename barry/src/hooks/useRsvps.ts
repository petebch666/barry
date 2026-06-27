import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UpsertRsvpSchema, type Rsvp, type UpsertRsvp } from '@/schemas';

const QUERY_KEY = 'rsvps';

export function useRsvps(pingId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, pingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rsvps')
        .select(`
          *,
          profiles(id, display_name, avatar_url)
        `)
        .eq('ping_id', pingId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as Rsvp[];
    },
    enabled: !!pingId,
  });
}

/** Subscribes to real-time RSVP changes for a ping. */
export function useRsvpsRealtime(pingId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!pingId) return;

    const channel = supabase
      .channel(`rsvps:${pingId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rsvps', filter: `ping_id=eq.${pingId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: [QUERY_KEY, pingId] });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pingId, queryClient]);
}

export function useUpsertRsvp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertRsvp) => {
      UpsertRsvpSchema.parse(input);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('rsvps')
        .upsert(
          {
            ping_id: input.ping_id,
            user_id: user.id,
            status: input.status,
            latitude: input.location?.latitude ?? null,
            longitude: input.location?.longitude ?? null,
            location_updated_at: input.location ? new Date().toISOString() : null,
          },
          { onConflict: 'ping_id,user_id' },
        );

      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, input.ping_id] });
    },
  });
}

/** Returns the current user's RSVP for a ping, if any. */
export function useMyRsvp(pingId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, pingId, 'mine'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('rsvps')
        .select('*')
        .eq('ping_id', pingId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as Rsvp | null;
    },
    enabled: !!pingId,
  });
}
