import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { SendFeedbackSchema, type FeedbackRating, type SendFeedback } from '@/schemas';

const QUERY_KEY = 'feedback';

function currentPlatform(): 'ios' | 'android' | 'web' | null {
  return Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web'
    ? Platform.OS
    : null;
}

export function useSendFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SendFeedback) => {
      const parsed = SendFeedbackSchema.parse(input);
      const { error } = await supabase.from('feedback').insert({
        kind: parsed.kind,
        rating: parsed.rating ?? null,
        message: parsed.message || null,
        ping_id: parsed.kind === 'ping_outcome' ? parsed.ping_id : null,
        app_version: Constants.expoConfig?.version ?? null,
        platform: currentPlatform(),
      });
      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      if (input.kind === 'ping_outcome') {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'outcome', input.ping_id] });
      }
    },
  });
}

/** The caller's thumbs up/down on a ping, or null if they haven't rated it. */
export function useMyPingOutcome(pingId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, 'outcome', pingId],
    queryFn: async (): Promise<FeedbackRating | null> => {
      const { data, error } = await supabase
        .from('feedback')
        .select('rating')
        .eq('kind', 'ping_outcome')
        .eq('ping_id', pingId)
        .maybeSingle();
      if (error) throw error;
      return (data?.rating as FeedbackRating | undefined) ?? null;
    },
    enabled: !!pingId,
  });
}
