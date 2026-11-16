import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useGroupMembers } from '@/hooks/useGroups';
import {
  RatePlaceSchema, UpdateSavedPlaceSchema,
  type SavedPlace, type Profile, type PlaceRatingValue, type RatePlace, type UpdateSavedPlace,
} from '@/schemas';

const QUERY_KEY = 'favorite-places';

export type FavoritePlace = SavedPlace & {
  profiles: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null;
  place_ratings: {
    rating: PlaceRatingValue;
    user_id: string;
    profiles: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null;
  }[];
};

/**
 * Places tab feed — own places plus everyone's you share a group with,
 * per the "saved_places: own or shared-group can read" RLS policy. No
 * explicit user filter needed here; RLS does the scoping.
 */
export function useFavoritePlaces() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_places')
        .select(`
          *,
          profiles(id, display_name, avatar_url),
          place_ratings(rating, user_id, profiles(id, display_name, avatar_url))
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as FavoritePlace[];
    },
  });
}

/** Upserts the current user's ternary rating on a place. */
export function useRatePlace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RatePlace) => {
      RatePlaceSchema.parse(input);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('place_ratings')
        .upsert({ ...input, user_id: user.id }, { onConflict: 'place_id,user_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/** Owner-only edit of a saved place's name/address/category. */
export function useUpdateSavedPlace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ placeId, updates }: { placeId: string; updates: UpdateSavedPlace }) => {
      const parsed = UpdateSavedPlaceSchema.parse(updates);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('saved_places')
        .update(parsed)
        .eq('id', placeId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'saved-places'] });
    },
  });
}

/**
 * A single group's members' favorite places — used by the suggest-place
 * picker. Reuses useGroupMembers rather than re-querying group_members.
 */
export function useGroupFavoritePlaces(groupId: string) {
  const { data: members } = useGroupMembers(groupId);
  const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id);

  return useQuery({
    queryKey: [QUERY_KEY, 'group', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_places')
        .select('*, profiles(id, display_name, avatar_url)')
        .in('user_id', memberIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as (SavedPlace & { profiles: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null })[];
    },
    enabled: !!groupId && memberIds.length > 0,
  });
}
