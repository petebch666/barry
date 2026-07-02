import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFavoritePlaces, useRatePlace, type FavoritePlace } from '@/hooks/useFavoritePlaces';
import { useProfile } from '@/hooks/useProfile';
import { GlassCard } from '@/components/GlassCard';
import { RatingPill } from '@/components/RatingPill';
import { colors, radii, BOTTOM_TAB_PADDING } from '@/lib/theme';
import type { PlaceRatingValue } from '@/schemas';

const RATING_VALUES: PlaceRatingValue[] = ['loved_it', 'it_was_fine', 'not_for_me'];

export default function PlacesScreen() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: places = [], isLoading, refetch, isRefetching } = useFavoritePlaces();
  const { mutateAsync: ratePlace } = useRatePlace();

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Places</Text>
          <TouchableOpacity
            onPress={() => router.push('/add-saved-place')}
            style={styles.addBtn}
            accessibilityRole="button"
            accessibilityLabel="Add a place"
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        >
          {isLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
          ) : places.length === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <Text style={styles.emptyText}>No places yet</Text>
              <Text style={styles.emptyHint}>
                Add a place you love, or wait for your group to add theirs.
              </Text>
            </GlassCard>
          ) : (
            places.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                currentUserId={profile?.id}
                onPress={() => router.push(`/(app)/(places)/${place.id}` as never)}
                onRate={(rating) => ratePlace({ place_id: place.id, rating })}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function PlaceCard({
  place, currentUserId, onPress, onRate,
}: {
  place: FavoritePlace;
  currentUserId: string | undefined;
  onPress: () => void;
  onRate: (rating: PlaceRatingValue) => void;
}) {
  const counts = place.place_ratings.reduce<Record<PlaceRatingValue, number>>((acc, r) => {
    acc[r.rating] = (acc[r.rating] ?? 0) + 1;
    return acc;
  }, { loved_it: 0, it_was_fine: 0, not_for_me: 0 });

  const myRating = place.place_ratings.find((r) => r.user_id === currentUserId)?.rating;
  const isOwner = place.user_id === currentUserId;

  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={place.name} activeOpacity={0.75}>
      <GlassCard style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
          {place.category && (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>{place.category}</Text>
            </View>
          )}
        </View>
        {place.address && (
          <Text style={styles.placeAddress} numberOfLines={1}>{place.address}</Text>
        )}
        <Text style={styles.attribution}>
          {isOwner ? 'Added by you' : `Added by ${place.profiles?.display_name ?? 'a group member'}`}
        </Text>

        <View style={styles.pillRow}>
          {RATING_VALUES.filter((r) => counts[r] > 0).map((r) => (
            <RatingPill key={r} rating={r} count={counts[r]} />
          ))}
        </View>

        <View style={styles.pillRow}>
          {RATING_VALUES.map((r) => (
            <RatingPill
              key={r}
              rating={r}
              selected={myRating === r}
              onPress={() => onRate(r)}
            />
          ))}
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  addBtnText: { fontSize: 14, fontWeight: '600', color: colors.text },

  scroll: { paddingHorizontal: 16, paddingBottom: BOTTOM_TAB_PADDING + 16, gap: 10 },

  card: { padding: 14, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  placeName: { fontSize: 16, fontWeight: '700', color: colors.text, flexShrink: 1 },
  categoryChip: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  placeAddress: { fontSize: 13, color: colors.textSecondary },
  attribution: { fontSize: 12, color: colors.textTertiary },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },

  emptyCard: { padding: 24, alignItems: 'center', gap: 6, marginTop: 16 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  emptyHint: { fontSize: 14, color: colors.textTertiary, textAlign: 'center' },
});
