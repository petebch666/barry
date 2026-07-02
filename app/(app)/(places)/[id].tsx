import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFavoritePlaces, useRatePlace } from '@/hooks/useFavoritePlaces';
import { useProfile, useDeleteSavedPlace } from '@/hooks/useProfile';
import { GlassCard } from '@/components/GlassCard';
import { RatingPill } from '@/components/RatingPill';
import PlaceMapPreview from '@/components/PlaceMapPreview';
import { openDirections } from '@/utils/openDirections';
import { colors, BOTTOM_TAB_PADDING } from '@/lib/theme';
import type { PlaceRatingValue } from '@/schemas';

const RATING_VALUES: PlaceRatingValue[] = ['loved_it', 'it_was_fine', 'not_for_me', 'want_to_try'];
const RATING_LABEL: Record<PlaceRatingValue, string> = {
  loved_it: 'Loved it',
  it_was_fine: 'It was fine',
  not_for_me: 'Not for me',
  want_to_try: 'Want to try',
};

export default function PlaceDetailScreen() {
  const { id: placeId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: places = [], isLoading } = useFavoritePlaces();
  const { mutateAsync: ratePlace } = useRatePlace();
  const { mutateAsync: deletePlace, isPending: isDeleting } = useDeleteSavedPlace();

  const place = places.find((p) => p.id === placeId);

  if (isLoading || !place) {
    return (
      <View style={styles.root}>
        <ActivityIndicator style={{ flex: 1 }} color={colors.accent} />
      </View>
    );
  }

  const isOwner = place.user_id === profile?.id;
  const myRating = place.place_ratings.find((r) => r.user_id === profile?.id)?.rating;

  function handleDelete() {
    const doDelete = async () => {
      try {
        await deletePlace(place!.id);
        router.back();
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Could not remove place.');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove "${place!.name}"?`)) doDelete();
    } else {
      Alert.alert('Remove place', `Remove "${place!.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: doDelete },
      ]);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <GlassCard style={styles.section}>
            <Text style={styles.placeName}>{place.name}</Text>
            {place.category && <Text style={styles.category}>{place.category}</Text>}
            {place.address && (
              <TouchableOpacity
                onPress={() => openDirections(place.latitude, place.longitude, place.name)}
                accessibilityRole="button"
                accessibilityLabel={`Get directions to ${place.name}`}
              >
                <Text style={[styles.address, styles.addressLink]}>{place.address}</Text>
              </TouchableOpacity>
            )}
            <PlaceMapPreview latitude={place.latitude} longitude={place.longitude} name={place.name} />
            <Text style={styles.attribution}>
              {isOwner ? 'Added by you' : `Added by ${place.profiles?.display_name ?? 'a group member'}`}
            </Text>
          </GlassCard>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your rating</Text>
            <View style={styles.pillRow}>
              {RATING_VALUES.map((r) => (
                <RatingPill
                  key={r}
                  rating={r}
                  selected={myRating === r}
                  onPress={() => ratePlace({ place_id: place.id, rating: r })}
                />
              ))}
            </View>
          </View>

          {place.place_ratings.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What your group thinks</Text>
              {place.place_ratings.map((r) => (
                <View key={r.user_id} style={styles.raterRow}>
                  <Text style={styles.raterName}>
                    {r.user_id === profile?.id ? 'You' : r.profiles?.display_name ?? 'A group member'}
                  </Text>
                  <Text style={styles.raterRating}>{RATING_LABEL[r.rating]}</Text>
                </View>
              ))}
            </View>
          )}

          {isOwner && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => router.push({ pathname: '/add-saved-place', params: { placeId: place.id } })}
                accessibilityRole="button"
                accessibilityLabel="Edit place"
              >
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerBtn, isDeleting && { opacity: 0.5 }]}
                onPress={handleDelete}
                disabled={isDeleting}
                accessibilityRole="button"
                accessibilityLabel="Delete place"
              >
                {isDeleting ? (
                  <ActivityIndicator color={colors.error} />
                ) : (
                  <Text style={styles.dangerBtnText}>Delete place</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safeArea: { flex: 1 },
  navBar: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
  backBtn: { paddingVertical: 4, alignSelf: 'flex-start' },
  backText: { fontSize: 17, color: colors.accent, fontWeight: '500' },
  scroll: { padding: 16, gap: 12, paddingBottom: BOTTOM_TAB_PADDING },
  section: { padding: 16, gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  placeName: { fontSize: 22, fontWeight: '700', color: colors.text },
  category: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, textTransform: 'capitalize' },
  address: { fontSize: 14, color: colors.textSecondary },
  addressLink: { color: colors.accent },
  attribution: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  raterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  raterName: { fontSize: 14, fontWeight: '600', color: colors.text },
  raterRating: { fontSize: 14, color: colors.textSecondary },
  editBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  editBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },
  dangerBtn: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  dangerBtnText: { fontSize: 15, fontWeight: '500', color: colors.error },
});
