import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, ScrollView,
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
  { value: 'in',    label: 'I\'m in!',       emoji: '✅', color: colors.success },
  { value: 'maybe', label: 'Maybe',           emoji: '🤔', color: colors.warning },
  { value: 'out',   label: 'Can\'t make it', emoji: '❌', color: colors.error },
];

type LocationMode = 'gps' | 'pin' | 'none';

const LOCATION_MODES: { value: LocationMode; label: string; description: string }[] = [
  { value: 'gps',  label: '📍 Current location', description: 'Share where you are right now' },
  { value: 'pin',  label: '📌 Pin on map',        description: 'Pick where you\'ll be later' },
  { value: 'none', label: '🚫 No location',       description: 'Skip — meeting point won\'t update' },
];

// Default map centre — used as starting pin position on first open
const DEFAULT_REGION = { latitude: 48.8566, longitude: 2.3522 }; // Paris

export default function RsvpModal() {
  const { pingId } = useLocalSearchParams<{ pingId: string }>();
  const router = useRouter();
  const { data: ping } = usePing(pingId);
  const { mutateAsync: upsertRsvp, isPending } = useUpsertRsvp();

  const [selected, setSelected] = useState<RsvpStatus>('in');
  const [locationMode, setLocationMode] = useState<LocationMode>('none');
  const [pinnedLocation, setPinnedLocation] = useState<{ latitude: number; longitude: number }>(DEFAULT_REGION);
  const [locating, setLocating] = useState(false);

  async function submit() {
    let location: { latitude: number; longitude: number } | null = null;

    if (selected === 'in') {
      if (locationMode === 'gps') {
        setLocating(true);
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              'Location permission denied',
              'Barry needs location access. You can still RSVP without sharing your location.',
            );
          } else {
            const pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            location = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          }
        } finally {
          setLocating(false);
        }
      } else if (locationMode === 'pin') {
        location = pinnedLocation;
      }
    }

    try {
      await upsertRsvp({ ping_id: pingId, status: selected, location: location ?? undefined });
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save your RSVP.');
    }
  }

  const showMapPicker = selected === 'in' && locationMode === 'pin' && Platform.OS !== 'web';

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

        {/* Status options */}
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

        {/* Location mode — only when 'in' */}
        {selected === 'in' && (
          <View style={styles.locationSection}>
            <Text style={styles.locationSectionTitle}>Location</Text>
            {LOCATION_MODES.filter(
              (m) => !(m.value === 'pin' && Platform.OS === 'web'),
            ).map((mode) => (
              <TouchableOpacity
                key={mode.value}
                style={[
                  styles.locationOption,
                  locationMode === mode.value && styles.locationOptionActive,
                ]}
                onPress={() => setLocationMode(mode.value)}
                accessibilityRole="radio"
                accessibilityLabel={mode.label}
                accessibilityState={{ checked: locationMode === mode.value }}
              >
                <View style={styles.locationOptionText}>
                  <Text style={[styles.locationOptionLabel, locationMode === mode.value && styles.locationOptionLabelActive]}>
                    {mode.label}
                  </Text>
                  <Text style={styles.locationOptionDesc}>{mode.description}</Text>
                </View>
                <View style={[styles.radioOuter, locationMode === mode.value && styles.radioOuterActive]}>
                  {locationMode === mode.value && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Map pin picker */}
        {showMapPicker && (
          <View style={styles.mapPickerWrapper}>
            <Text style={styles.mapPickerHint}>Drag the marker to where you'll be</Text>
            <PinMapPicker
              initialLocation={pinnedLocation}
              onLocationChange={setPinnedLocation}
            />
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, (isPending || locating) && styles.submitDisabled]}
          onPress={submit}
          disabled={isPending || locating}
          accessibilityRole="button"
          accessibilityLabel="Confirm RSVP"
        >
          {isPending || locating ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.submitText}>Confirm</Text>
          )}
        </TouchableOpacity>
      </View>
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

  // Status options
  options: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionEmoji: { fontSize: 22 },
  optionLabel: { fontSize: 16, fontWeight: '600', color: colors.text },

  // Location section
  locationSection: { gap: 8 },
  locationSectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  locationOptionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '14',
  },
  locationOptionText: { flex: 1, gap: 2 },
  locationOptionLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  locationOptionLabelActive: { color: colors.accent },
  locationOptionDesc: { fontSize: 12, color: colors.textTertiary },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: { borderColor: colors.accent },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },

  // Map picker
  mapPickerWrapper: { gap: 8 },
  mapPickerHint: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },

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
});
