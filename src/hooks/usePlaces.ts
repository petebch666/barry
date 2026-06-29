import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { SuggestPlaceSchema, type Place, type SuggestPlace } from '@/schemas';

const QUERY_KEY = 'places';

export function usePlaces(pingId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, pingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('places')
        .select(`
          *,
          profiles(id, display_name)
        `)
        .eq('ping_id', pingId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Place[];
    },
    enabled: !!pingId,
  });
}

/** Subscribes to real-time place inserts (fired when Edge Function populates suggestions). */
export function usePlacesRealtime(pingId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!pingId) return;

    const channel = supabase
      .channel(`places:${pingId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'places', filter: `ping_id=eq.${pingId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: [QUERY_KEY, pingId] });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pingId, queryClient]);
}

export function useSuggestPlace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SuggestPlace) => {
      SuggestPlaceSchema.parse(input);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('places')
        .insert({
          ...input,
          source: 'manual',
          suggested_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Place;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, input.ping_id] });
    },
  });
}
