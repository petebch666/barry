import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle } from 'react-native-maps';
import { usePing, usePingRealtime, useStartVoting } from '@/hooks/usePings';
import { useRsvps, useRsvpsRealtime, useMyRsvp } from '@/hooks/useRsvps';
import { usePlaces, usePlacesRealtime } from '@/hooks/usePlaces';
import { useVotes, useVotesRealtime, useCastVote, useMyVote, useVoteCounts } from '@/hooks/useVotes';
import { computeBarycenter, haversineMeters } from '@/utils/barycenter';
import type { Place } from '@/schemas';

export default function PingDetailScreen() {
  const { id: pingId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // Data
  const { data: ping, isLoading } = usePing(pingId);
  const { data: rsvps = [] } = useRsvps(pingId);
  const { data: places = [] } = usePlaces(pingId);
  const { data: votes = [] } = useVotes(pingId);
  const { data: myRsvp } = useMyRsvp(pingId);
  const { data: myVote } = useMyVote(pingId);
  const voteCounts = useVoteCounts(pingId);

  // Realtime subscriptions — all unsubscribe automatically on unmount
  usePingRealtime(pingId);
  useRsvpsRealtime(pingId);
  usePlacesRealtime(pingId);
  useVotesRealtime(pingId);

  const { mutateAsync: startVoting, isPending: isStartingVoting } = useStartVoting();
  const { mutateAsync: castVote, isPending: isCasting } = useCastVote();

  // Compute barycenter from "in" RSVPs that have location
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
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator style={{ flex: 1 }} color="#3B82F6" />
      </SafeAreaView>
    );
  }

  const isCreator = ping.created_by === myRsvp?.user_id;
  const canStartVoting = ping.status === 'open' && inCount >= 2;
  const isConfirmed = ping.status === 'confirmed';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Header ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.message}>{ping.message}</Text>
          <View style={styles.meta}>
            <StatusBadge status={ping.status} />
            <Text style={styles.rsvpCount}>{inCount}/{totalCount} in</Text>
          </View>
        </View>

        {/* ── RSVP button (if not yet responded) ──────────────── */}
        {!myRsvp && ping.status === 'open' && (
          <TouchableOpacity
            style={styles.rsvpButton}
            onPress={() => router.push(`/rsvp/${pingId}`)}
            accessibilityRole="button"
            accessibilityLabel="Respond to this ping"
          >
            <Text style={styles.rsvpButtonText}>Are you in? →</Text>
          </TouchableOpacity>
        )}

        {/* ── My RSVP status ──────────────────────────────────── */}
        {myRsvp && (
          <View style={styles.myRsvpRow}>
            <Text style={styles.myRsvpLabel}>
              Your answer: <Text style={styles.myRsvpValue}>{myRsvp.status}</Text>
            </Text>
            {ping.status === 'open' && (
              <TouchableOpacity onPress={() => router.push(`/rsvp/${pingId}`)}>
                <Text style={styles.changeLink}>Change</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Map with barycenter ──────────────────────────────── */}
        {barycenter && (
          <View style={styles.mapWrapper}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: barycenter.latitude,
                longitude: barycenter.longitude,
                latitudeDelta: 0.04,
                longitudeDelta: 0.04,
              }}
              accessible={false}
            >
              {/* Barycenter pin */}
              <Marker
                coordinate={barycenter}
                title="Meeting point"
                description="Geographic centre of everyone's location"
                pinColor="#3B82F6"
              />

              {/* Members' location markers */}
              {inRsvpsWithLocation.map((r) => (
                <Marker
                  key={r.id}
                  coordinate={{ latitude: r.latitude!, longitude: r.longitude! }}
                  pinColor="#94A3B8"
                />
              ))}

              {/* Place markers */}
              {places.map((p) => (
                <Marker
                  key={p.id}
                  coordinate={{ latitude: p.latitude, longitude: p.longitude }}
                  title={p.name}
                  pinColor="#F59E0B"
                />
              ))}

              {/* Search radius indicator */}
              <Circle
                center={barycenter}
                radius={800}
                strokeColor="#3B82F620"
                fillColor="#3B82F608"
              />
            </MapView>
          </View>
        )}

        {/* ── Start voting button (creator, when ≥2 "in") ──────── */}
        {isCreator && canStartVoting && (
          <TouchableOpacity
            style={styles.startVotingButton}
            onPress={() => startVoting(pingId)}
            disabled={isStartingVoting}
            accessibilityRole="button"
            accessibilityLabel="Find places and start voting"
          >
            {isStartingVoting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.startVotingText}>Find places & vote →</Text>
            )}
          </TouchableOpacity>
        )}

        {/* ── Place suggestions + voting ───────────────────────── */}
        {(ping.status === 'voting' || ping.status === 'confirmed') && places.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {ping.status === 'confirmed' ? 'Confirmed venue' : 'Vote for a place'}
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

            {/* Suggest a place button */}
            {ping.status === 'voting' && myRsvp?.status === 'in' && (
              <TouchableOpacity
                style={styles.suggestButton}
                onPress={() => router.push(`/suggest-place/${pingId}`)}
                accessibilityRole="button"
                accessibilityLabel="Suggest a place"
              >
                <Text style={styles.suggestButtonText}>+ Suggest a place</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Empty state while places load ───────────────────── */}
        {ping.status === 'voting' && places.length === 0 && (
          <View style={styles.loadingPlaces}>
            <ActivityIndicator color="#3B82F6" />
            <Text style={styles.loadingPlacesText}>Finding places near your meeting point…</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: '#3B82F6', voting: '#F59E0B', confirmed: '#10B981', cancelled: '#94A3B8',
  };
  const color = colors[status] ?? '#94A3B8';
  return (
    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
      <Text style={[styles.badgeText, { color }]}>{status}</Text>
    </View>
  );
}

interface PlaceCardProps {
  place: Place;
  votes: number;
  totalIn: number;
  myVotePlaceId: string | null | undefined;
  barycenter: { latitude: number; longitude: number } | null;
  isConfirmed: boolean;
  onVote: () => void;
  isCasting: boolean;
}

function PlaceCard({
  place, votes, totalIn, myVotePlaceId, barycenter, isConfirmed, onVote, isCasting,
}: PlaceCardProps) {
  const isMyVote = myVotePlaceId === place.id;
  const distanceM = barycenter
    ? Math.round(haversineMeters(barycenter, { latitude: place.latitude, longitude: place.longitude }))
    : null;

  return (
    <View style={[styles.placeCard, isConfirmed && styles.placeCardConfirmed]}>
      <View style={styles.placeTop}>
        <View style={styles.placeInfo}>
          <Text style={styles.placeName}>{place.name}</Text>
          {place.address && <Text style={styles.placeAddress} numberOfLines={1}>{place.address}</Text>}
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
            style={[styles.voteButton, isMyVote && styles.voteButtonActive]}
            onPress={onVote}
            disabled={isCasting}
            accessibilityRole="button"
            accessibilityLabel={isMyVote ? `Voted for ${place.name}` : `Vote for ${place.name}`}
          >
            <Text style={[styles.voteButtonText, isMyVote && styles.voteButtonTextActive]}>
              {isMyVote ? '✓ Voted' : 'Vote'}
            </Text>
          </TouchableOpacity>
        )}

        {isConfirmed && (
          <View style={styles.confirmedBadge}>
            <Text style={styles.confirmedText}>✓ Confirmed</Text>
          </View>
        )}
      </View>

      {/* Vote bar */}
      <View style={styles.voteBar}>
        <View
          style={[
            styles.voteBarFill,
            { width: totalIn > 0 ? `${(votes / totalIn) * 100}%` : '0%' as any },
          ]}
        />
      </View>
      <Text style={styles.voteCount}>{votes}/{totalIn} votes</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 20, gap: 16 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  message: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  rsvpCount: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  rsvpButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  rsvpButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  myRsvpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  myRsvpLabel: { fontSize: 14, color: '#64748B' },
  myRsvpValue: { fontWeight: '600', color: '#1E293B', textTransform: 'capitalize' },
  changeLink: { fontSize: 14, color: '#3B82F6', fontWeight: '500' },
  mapWrapper: { borderRadius: 14, overflow: 'hidden', height: 220 },
  map: { flex: 1 },
  startVotingButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startVotingText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  loadingPlaces: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  loadingPlacesText: { fontSize: 14, color: '#64748B' },
  // Place card
  placeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  placeCardConfirmed: { borderColor: '#10B981', borderWidth: 2 },
  placeTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  placeInfo: { flex: 1, gap: 3 },
  placeName: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  placeAddress: { fontSize: 13, color: '#64748B' },
  placeMeta: { flexDirection: 'row', gap: 10, marginTop: 4 },
  placeMetaText: { fontSize: 12, color: '#94A3B8' },
  voteButton: {
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  voteButtonActive: { backgroundColor: '#3B82F6' },
  voteButtonText: { fontSize: 14, fontWeight: '600', color: '#3B82F6' },
  voteButtonTextActive: { color: '#FFFFFF' },
  confirmedBadge: {
    backgroundColor: '#10B98122',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  confirmedText: { fontSize: 13, fontWeight: '600', color: '#10B981' },
  voteBar: {
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    overflow: 'hidden',
  },
  voteBarFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 2 },
  voteCount: { fontSize: 12, color: '#94A3B8' },
  suggestButton: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  suggestButtonText: { fontSize: 15, fontWeight: '500', color: '#64748B' },
});
