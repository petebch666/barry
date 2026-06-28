import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePing, usePingRealtime, useStartVoting } from '@/hooks/usePings';
import { useRsvps, useRsvpsRealtime, useMyRsvp } from '@/hooks/useRsvps';
import { usePlaces, usePlacesRealtime } from '@/hooks/usePlaces';
import { useVotes, useVotesRealtime, useCastVote, useMyVote, useVoteCounts } from '@/hooks/useVotes';
import { computeBarycenter, haversineMeters } from '@/utils/barycenter';
import { GlassCard } from '@/components/GlassCard';
import { GlassButton } from '@/components/GlassButton';
import { Badge } from '@/components/Badge';
import { colors, BOTTOM_TAB_PADDING } from '@/lib/theme';
import PingMap from '@/components/PingMap';
import type { Place } from '@/schemas';

export default function PingDetailScreen() {
  const { id: pingId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: ping, isLoading } = usePing(pingId);
  const { data: rsvps = [] } = useRsvps(pingId);
  const { data: places = [] } = usePlaces(pingId);
  const { data: myRsvp } = useMyRsvp(pingId);
  const { data: myVote } = useMyVote(pingId);
  const voteCounts = useVoteCounts(pingId);

  usePingRealtime(pingId);
  useRsvpsRealtime(pingId);
  usePlacesRealtime(pingId);
  useVotesRealtime(pingId);

  const { mutateAsync: startVoting, isPending: isStartingVoting } = useStartVoting();
  const { mutateAsync: castVote, isPending: isCasting } = useCastVote();

  const inRsvpsWithLocation = rsvps.filter(
    (r) => r.status === 'in' && r.latitude != null && r.longitude != null,
  );
  const barycenter = computeBarycenter(
    inRsvpsWithLocation.map((r) => ({ latitude: r.latitude!, longitude: r.longitude! })),
  );

  const inCount = rsvps.filter((r) => r.status === 'in').length;
  const totalCount = rsvps.length;

  if (isLoading || !ping) {
    return (
      <View style={styles.root}>
        <ActivityIndicator style={{ flex: 1 }} color={colors.accent} />
      </View>
    );
  }

  const isCreator = ping.created_by === myRsvp?.user_id;
  const canStartVoting = ping.status === 'open' && inCount >= 2;
  const isConfirmed = ping.status === 'confirmed';

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Back header */}
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header card */}
          <GlassCard style={styles.section}>
            <Text style={styles.message}>{ping.message}</Text>
            <View style={styles.meta}>
              <Badge status={ping.status} />
              <Text style={styles.rsvpCount}>{inCount}/{totalCount} in</Text>
            </View>
          </GlassCard>

          {/* RSVP button */}
          {!myRsvp && ping.status === 'open' && (
            <GlassButton
              label="Are you in? →"
              onPress={() => router.push(`/rsvp/${pingId}`)}
              accessibilityLabel="Respond to this ping"
            />
          )}

          {/* My RSVP status */}
          {myRsvp && (
            <View style={styles.myRsvpRow}>
              <Text style={styles.myRsvpLabel}>
                Your answer:{' '}
                <Text style={styles.myRsvpValue}>{myRsvp.status}</Text>
              </Text>
              {ping.status === 'open' && (
                <TouchableOpacity onPress={() => router.push(`/rsvp/${pingId}`)}>
                  <Text style={styles.changeLink}>Change</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Map (native only via platform-specific file) */}
          {barycenter && (
            <PingMap
              barycenter={barycenter}
              memberLocations={inRsvpsWithLocation.map((r) => ({
                id: r.id,
                latitude: r.latitude!,
                longitude: r.longitude!,
              }))}
              places={places.map((p) => ({
                id: p.id,
                latitude: p.latitude,
                longitude: p.longitude,
                name: p.name,
              }))}
            />
          )}

          {/* Start voting */}
          {isCreator && canStartVoting && (
            <GlassButton
              label={isStartingVoting ? '' : 'Find places & vote →'}
              loading={isStartingVoting}
              onPress={() => startVoting(pingId)}
              accessibilityLabel="Find places and start voting"
            />
          )}

          {/* Places + voting */}
          {(ping.status === 'voting' || isConfirmed) && places.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {isConfirmed ? 'Confirmed venue' : 'Vote for a place'}
              </Text>
              {places.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  votes={voteCounts[place.id] ?? 0}
                  totalIn={inCount}
                  myVotePlaceId={myVote}
                  barycenter={barycenter}
                  isConfirmed={isConfirmed && ping.confirmed_place_id === place.id}
                  onVote={async () => {
                    if (ping.status !== 'voting') return;
                    await castVote({ ping_id: pingId, place_id: place.id });
                  }}
                  isCasting={isCasting}
                />
              ))}

              {ping.status === 'voting' && myRsvp?.status === 'in' && (
                <TouchableOpacity
                  style={styles.suggestBtn}
                  onPress={() => router.push(`/suggest-place/${pingId}`)}
                  accessibilityRole="button"
                  accessibilityLabel="Suggest a place"
                >
                  <Text style={styles.suggestBtnText}>+ Suggest a place</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {ping.status === 'voting' && places.length === 0 && (
            <View style={styles.loadingPlaces}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.loadingPlacesText}>Finding places near your meeting point…</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function PlaceCard({
  place, votes, totalIn, myVotePlaceId, barycenter, isConfirmed, onVote, isCasting,
}: {
  place: Place;
  votes: number;
  totalIn: number;
  myVotePlaceId: string | null | undefined;
  barycenter: { latitude: number; longitude: number } | null;
  isConfirmed: boolean;
  onVote: () => void;
  isCasting: boolean;
}) {
  const isMyVote = myVotePlaceId === place.id;
  const distanceM = barycenter
    ? Math.round(haversineMeters(barycenter, { latitude: place.latitude, longitude: place.longitude }))
    : null;

  return (
    <GlassCard style={[styles.placeCard, isConfirmed && styles.placeCardConfirmed]}>
      <View style={styles.placeTop}>
        <View style={styles.placeInfo}>
          <Text style={styles.placeName}>{place.name}</Text>
          {place.address && (
            <Text style={styles.placeAddress} numberOfLines={1}>{place.address}</Text>
          )}
          <View style={styles.placeMeta}>
            {distanceM != null && (
              <Text style={styles.placeMetaText}>
                {distanceM < 1000 ? `${distanceM} m` : `${(distanceM / 1000).toFixed(1)} km`} away
              </Text>
            )}
            {place.rating != null && (
              <Text style={styles.placeMetaText}>⭐ {place.rating.toFixed(1)}</Text>
            )}
            {place.source === 'manual' && (
              <Text style={styles.placeMetaText}>✋ suggested</Text>
            )}
          </View>
        </View>

        {!isConfirmed && (
          <TouchableOpacity
            style={[styles.voteBtn, isMyVote && styles.voteBtnActive]}
            onPress={onVote}
            disabled={isCasting}
            accessibilityRole="button"
            accessibilityLabel={isMyVote ? `Voted for ${place.name}` : `Vote for ${place.name}`}
          >
            <Text style={[styles.voteBtnText, isMyVote && styles.voteBtnTextActive]}>
              {isMyVote ? '✓ Voted' : 'Vote'}
            </Text>
          </TouchableOpacity>
        )}

        {isConfirmed && (
          <View style={styles.confirmedBadge}>
            <Text style={styles.confirmedText}>✓ Yes!</Text>
          </View>
        )}
      </View>

      <View style={styles.voteBar}>
        <View
          style={[
            styles.voteBarFill,
            { width: totalIn > 0 ? `${(votes / totalIn) * 100}%` : '0%' as any },
          ]}
        />
      </View>
      <Text style={styles.voteCount}>{votes}/{totalIn} votes</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safeArea: { flex: 1 },
  navBar: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  backBtn: { paddingVertical: 4, alignSelf: 'flex-start' },
  backText: { fontSize: 17, color: colors.accent, fontWeight: '500' },
  scroll: { padding: 16, gap: 12, paddingBottom: BOTTOM_TAB_PADDING },
  section: { padding: 16, gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  message: { fontSize: 20, fontWeight: '700', color: colors.text, lineHeight: 26 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rsvpCount: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  myRsvpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  myRsvpLabel: { fontSize: 14, color: colors.textSecondary },
  myRsvpValue: { fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  changeLink: { fontSize: 14, color: colors.accent, fontWeight: '500' },
  loadingPlaces: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  loadingPlacesText: { fontSize: 14, color: colors.textSecondary },
  suggestBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  suggestBtnText: { fontSize: 15, fontWeight: '500', color: colors.textSecondary },
  placeCard: { padding: 14, gap: 8 },
  placeCardConfirmed: { borderColor: colors.success },
  placeTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  placeInfo: { flex: 1, gap: 3 },
  placeName: { fontSize: 16, fontWeight: '600', color: colors.text },
  placeAddress: { fontSize: 13, color: colors.textSecondary },
  placeMeta: { flexDirection: 'row', gap: 10, marginTop: 4 },
  placeMetaText: { fontSize: 12, color: colors.textTertiary },
  voteBtn: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  voteBtnActive: { backgroundColor: colors.accent },
  voteBtnText: { fontSize: 14, fontWeight: '600', color: colors.accent },
  voteBtnTextActive: { color: colors.text },
  confirmedBadge: {
    backgroundColor: colors.success + '28',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  confirmedText: { fontSize: 13, fontWeight: '600', color: colors.success },
  voteBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  voteBarFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 2 },
  voteCount: { fontSize: 12, color: colors.textTertiary },
});
