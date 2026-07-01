import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useUpsertRsvp } from '@/hooks/useRsvps';
import { usePing } from '@/hooks/usePings';
import { colors, radii } from '@/lib/theme';
import type { RsvpStatus } from '@/schemas';
import PinMapPicker from '@/components/PinMapPicker';

const STATUS_OPTIONS: { value: RsvpStatus; label: string; emoji: string; color: string }[] = [
  { value: 'in',    label: "I'm in!",       emoji: '✅', color: colors.success },
  { value: 'maybe', label: 'Maybe',          emoji: '🤔', color: colors.warning },
  { value: 'out',   label: "Can't make it", emoji: '❌', color: colors.error },
];

type LocationMode = 'gps' | 'pin' | 'none';

const LOCATION_MODES: { value: LocationMode; label: string }[] = [
  { value: 'gps',  label: '📍 Current location' },
  { value: 'pin',  label: '📌 Set on map' },
  { value: 'none', label: '🚫 No location' },
];

const DEFAULT_REGION = { latitude: 48.8566, longitude: 2.3522 };

export default function RsvpModal() {
  const { pingId } = useLocalSearchParams<{ pingId: string }>();
  const router = useRouter();
  const { data: ping } = usePing(pingId);
  const { mutateAsync: upsertRsvp, isPending } = useUpsertRsvp();

  const [selected, setSelected] = useState<RsvpStatus>('in');
  const [locationMode, setLocationMode] = useState<LocationMode>('none');
  const [pinnedLocation, setPinnedLocation] = useState(DEFAULT_REGION);
  const [pendingLocation, setPendingLocation] = useState(DEFAULT_REGION);
  const [showMapModal, setShowMapModal] = useState(false);
  const [locating, setLocating] = useState(false);

  async function handleLocationTap(mode: LocationMode) {
    setLocationMode(mode);
    if (mode === 'none') return;

    if (mode === 'gps') {
      setShowMapModal(true);
      setLocating(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Location permission denied',
            'Barry needs location access. You can still RSVP without sharing your location.',
          );
          setShowMapModal(false);
          setLocationMode('none');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setPendingLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } finally {
        setLocating(false);
      }
    } else {
      setPendingLocation(pinnedLocation);
      setShowMapModal(true);
    }
  }

  function confirmMapLocation() {
    setPinnedLocation(pendingLocation);
    setShowMapModal(false);
  }

  function cancelMapModal() {
    setShowMapModal(false);
    setLocationMode('none');
  }

  async function submit() {
    let location: { latitude: number; longitude: number } | null = null;
    if (selected === 'in' && (locationMode === 'gps' || locationMode === 'pin')) {
      location = pinnedLocation;
    }
    try {
      await upsertRsvp({ ping_id: pingId, status: selected, location: location ?? undefined });
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save your RSVP.');
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Your RSVP</Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {ping && (
          <View style={styles.pingPreview}>
            <Text style={styles.pingMessage} numberOfLines={2}>{ping.message}</Text>
          </View>
        )}

        {/* Status options — horizontal row */}
        <View style={styles.options}>
          {STATUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.option,
                selected === opt.value && { borderColor: opt.color, backgroundColor: opt.color + '22' },
              ]}
              onPress={() => setSelected(opt.value)}
              accessibilityRole="radio"
              accessibilityLabel={opt.label}
              accessibilityState={{ checked: selected === opt.value }}
            >
              <Text style={styles.optionEmoji}>{opt.emoji}</Text>
              <Text style={[styles.optionLabel, selected === opt.value && { color: opt.color }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Location mode — horizontal row, only when 'in' */}
        {selected === 'in' && (
          <View style={styles.locationSection}>
            <Text style={styles.locationSectionTitle}>Location</Text>
            <View style={styles.locationRow}>
              {LOCATION_MODES.map((mode) => (
                <TouchableOpacity
                  key={mode.value}
                  style={[
                    styles.locationOption,
                    locationMode === mode.value && styles.locationOptionActive,
                  ]}
                  onPress={() => handleLocationTap(mode.value)}
                  accessibilityRole="radio"
                  accessibilityLabel={mode.label}
                  accessibilityState={{ checked: locationMode === mode.value }}
                >
                  <Text style={[styles.locationOptionLabel, locationMode === mode.value && styles.locationOptionLabelActive]}>
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, isPending && styles.submitDisabled]}
          onPress={submit}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel="Confirm RSVP"
        >
          {isPending ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.submitText}>Confirm</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Location map modal */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={cancelMapModal}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={cancelMapModal} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {locationMode === 'gps' ? 'Your location' : 'Set location'}
            </Text>
            <TouchableOpacity onPress={confirmMapLocation} disabled={locating} accessibilityRole="button" accessibilityLabel="Confirm">
              <Text style={[styles.modalConfirm, locating && { opacity: 0.4 }]}>Confirm</Text>
            </TouchableOpacity>
          </View>

          {locating ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.modalLoadingText}>Finding your location…</Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <PinMapPicker
                initialLocation={pendingLocation}
                onLocationChange={setPendingLocation}
              />
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancel: { fontSize: 16, color: colors.textSecondary },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  scroll: { padding: 20, gap: 16, paddingBottom: 8 },
  pingPreview: {
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pingMessage: { fontSize: 16, fontWeight: '600', color: colors.text },

  // Status options — horizontal row of compact chips
  options: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 6,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionEmoji: { fontSize: 20 },
  optionLabel: { fontSize: 13, fontWeight: '600', color: colors.text, textAlign: 'center' },

  // Location section
  locationSection: { gap: 8 },
  locationSectionTitle: {
    fontSize: 13, fontWeight: '600', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  locationRow: { flexDirection: 'row', gap: 8 },
  locationOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationOptionActive: { borderColor: colors.accent, backgroundColor: colors.accent + '14' },
  locationOptionLabel: { fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center' },
  locationOptionLabelActive: { color: colors.accent },

  // Footer
  footer: { padding: 20, paddingTop: 8 },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: 18,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.text, fontSize: 17, fontWeight: '600' },

  // Map modal
  modalContainer: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  modalCancel: { fontSize: 16, color: colors.textSecondary },
  modalConfirm: { fontSize: 16, fontWeight: '600', color: colors.accent },
  modalLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  modalLoadingText: { fontSize: 14, color: colors.textSecondary },
});
