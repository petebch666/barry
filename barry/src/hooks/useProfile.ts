import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { SavedPlaceSchema, type Profile, type SavedPlace } from '@/schemas';
import { z } from 'zod';

const SavePlaceInputSchema = SavedPlaceSchema.pick({
  name: true, address: true, latitude: true, longitude: true, category: true,
}).extend({
  google_place_id: z.string().nullable().optional(),
});

const QUERY_KEY = 'profile';

export function useProfile() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data as Profile;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<Pick<Profile, 'display_name' | 'avatar_url'>>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useSavePlace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: z.infer<typeof SavePlaceInputSchema>) => {
      const parsed = SavePlaceInputSchema.parse(input);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('saved_places')
        .insert({ ...parsed, user_id: user.id });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'saved-places'] });
    },
  });
}

export function useDeleteSavedPlace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (placeId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('saved_places')
        .delete()
        .eq('id', placeId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'saved-places'] });
    },
  });
}

export function useSavedPlaces() {
  return useQuery({
    queryKey: [QUERY_KEY, 'saved-places'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('saved_places')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SavedPlace[];
    },
  });
}
