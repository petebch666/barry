import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFeedPings } from '@/hooks/usePings';
import { useRsvps } from '@/hooks/useRsvps';
import { usePlaces } from '@/hooks/usePlaces';
import { computeBarycenter } from '@/utils/barycenter';
import type { Ping } from '@/schemas';

/**
 * Full-screen map tab: shows the most recently active ping's barycenter,
 * member markers, and place pins. Tap a ping chip to switch context.
 */
export default function MapScreen() {
  const router = useRouter();
  const { data: pings = [], isLoading } = useFeedPings();

  const activePings = useMemo(
    () => pings.filter((p) => p.status === 'open' || p.status === 'voting'),
    [pings],
  );

  const [selectedPingId, setSelectedPingId] = useState<string | null>(
    activePings[0]?.id ?? null,
  );

  const currentPingId = selectedPingId ?? activePings[0]?.id ?? null;

  const { data: rsvps = [] } = useRsvps(currentPingId ?? '');
  const { data: places = [] } = usePlaces(currentPingId ?? '');

  const inRsvpsWithLocation = useMemo(
    () => rsvps.filter((r) => r.status === 'in' && r.latitude != null && r.longitude != null),
    [rsvps],
  );

  const barycenter = useMemo(
    () => computeBarycenter(
      inRsvpsWithLocation.map((r) => ({ latitude: r.latitude!, longitude: r.longitude! })),
    ),
    [inRsvpsWithLocation],
  );

  const initialRegion = barycenter
    ? { latitude: barycenter.latitude, longitude: barycenter.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : { latitude: 48.8566, longitude: 2.3522, latitudeDelta: 0.08, longitudeDelta: 0.08 };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator color="#6366F1" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (activePings.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.heading}>Map</Text>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No active pings.</Text>
          <Text style={styles.emptyHint}>Send a ping to start coordinating a meetup.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Full-screen map */}
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Barycenter pin */}
        {barycenter && (
          <>
            <Marker
              coordinate={barycenter}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={10}
            >
              <View style={styles.barycenterMarker}>
                <Text style={styles.barycenterEmoji}>⭐</Text>
              </View>
            </Marker>
            <Circle
              center={barycenter}
              radius={800}
              strokeColor="rgba(99,102,241,0.4)"
              fillColor="rgba(99,102,241,0.06)"
              strokeWidth={1.5}
            />
          </>
        )}

        {/* Member location markers */}
        {inRsvpsWithLocation.map((r) => (
          <Marker
            key={r.id}
            coordinate={{ latitude: r.latitude!, longitude: r.longitude! }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.memberMarker} />
          </Marker>
        ))}

        {/* Place suggestion markers */}
        {places.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            title={p.name}
            description={p.address ?? undefined}
          >
            <View style={styles.placeMarker}>
              <Text style={styles.placeMarkerEmoji}>🍺</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Safe area overlay for ping selector at the top */}
      <SafeAreaView edges={['top']} style={styles.overlay} pointerEvents="box-none">
        <View style={styles.header}>
          <Text style={styles.heading}>Map</Text>
        </View>

        {/* Ping selector chips */}
        <FlatList
          horizontal
          data={activePings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chipsContainer}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <PingChip
              ping={item}
              selected={item.id === currentPingId}
              onPress={() => {
                setSelectedPingId(item.id);
              }}
              onLongPress={() => router.push(`/(app)/(feed)/ping/${item.id}`)}
            />
          )}
        />
      </SafeAreaView>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.legendDotBlue} />
          <Text style={styles.legendLabel}>Member</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={{ fontSize: 10 }}>⭐</Text>
          <Text style={styles.legendLabel}>Barycenter</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={{ fontSize: 10 }}>🍺</Text>
          <Text style={styles.legendLabel}>Venue</Text>
        </View>
      </View>
    </View>
  );
}

function PingChip({
  ping,
  selected,
  onPress,
  onLongPress,
}: {
  ping: Ping;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Select ping: ${ping.message}`}
      accessibilityHint="Long-press to open ping detail"
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
        {ping.message}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(248,250,252,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  heading: { fontSize: 28, fontWeight: '700', color: '#1E293B' },

  chipsContainer: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    maxWidth: 220,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  chipSelected: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  chipTextSelected: { color: '#FFF' },

  barycenterMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    borderWidth: 2,
    borderColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barycenterEmoji: { fontSize: 16 },

  memberMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#64748B',
    borderWidth: 2,
    borderColor: '#FFF',
  },

  placeMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeMarkerEmoji: { fontSize: 14 },

  legend: {
    position: 'absolute',
    bottom: 32,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    padding: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDotBlue: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#64748B' },
  legendLabel: { fontSize: 11, color: '#475569', fontWeight: '500' },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#1E293B', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#64748B', textAlign: 'center' },
});
