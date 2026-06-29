import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { CreatePingSchema, type Ping, type CreatePing } from '@/schemas';

const QUERY_KEY = 'pings';

/** All active pings across the current user's groups, for the Feed screen. */
export function useFeedPings() {
  return useQuery({
    queryKey: [QUERY_KEY, 'feed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pings')
        .select(`
          *,
          groups(id, name),
          profiles!pings_created_by_fkey(id, display_name, avatar_url),
          rsvps(id, user_id, status)
        `)
        .in('status', ['open', 'voting', 'confirmed'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as (Ping & { groups: { id: string; name: string } })[];
    },
  });
}

/** Pings for a specific group. */
export function useGroupPings(groupId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, 'group', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pings')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Ping[];
    },
    enabled: !!groupId,
  });
}

/** Single ping with full detail — used by PingDetailScreen. */
export function usePing(pingId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, pingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pings')
        .select(`
          *,
          groups(id, name),
          profiles!pings_created_by_fkey(id, display_name, avatar_url)
        `)
        .eq('id', pingId)
        .single();

      if (error) throw error;
      return data as Ping;
    },
    enabled: !!pingId,
  });
}

/** Subscribes to real-time status changes on a single ping. */
export function usePingRealtime(pingId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!pingId) return;

    const channel = supabase
      .channel(`ping-status:${pingId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pings', filter: `id=eq.${pingId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: [QUERY_KEY, pingId] });
          queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'feed'] });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pingId, queryClient]);
}

export function useCreatePing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePing) => {
      CreatePingSchema.parse(input);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('pings')
        .insert({ ...input, created_by: user.id })
        .select()
        .single();

      if (error) throw error;

      // Creator is implicitly "in" — auto-RSVP so they're counted without extra steps.
      // Location is null here; the ping detail prompts them to share it.
      await supabase
        .from('rsvps')
        .insert({ ping_id: data.id, user_id: user.id, status: 'in' });

      return data as Ping;
    },
    onSuccess: (ping) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'feed'] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'group', ping.group_id] });
    },
  });
}

export function useStartVoting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pingId: string) => {
      const { error } = await supabase
        .from('pings')
        .update({ status: 'voting' })
        .eq('id', pingId);

      if (error) throw error;
    },
    onSuccess: (_data, pingId) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, pingId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'feed'] });
    },
  });
}
