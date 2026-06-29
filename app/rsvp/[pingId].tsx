import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useUpsertRsvp } from '@/hooks/useRsvps';
import { usePing } from '@/hooks/usePings';
import { colors, radii } from '@/lib/theme';
import type { RsvpStatus } from '@/schemas';

const STATUS_OPTIONS: { value: RsvpStatus; label: string; emoji: string; color: string }[] = [
  { value: 'in',    label: 'I\'m in!',       emoji: '✅', color: colors.success },
  { value: 'maybe', label: 'Maybe',           emoji: '🤔', color: colors.warning },
  { value: 'out',   label: 'Can\'t make it', emoji: '❌', color: colors.error },
];

export default function RsvpModal() {
  const { pingId } = useLocalSearchParams<{ pingId: string }>();
  const router = useRouter();
  const { data: ping } = usePing(pingId);
  const { mutateAsync: upsertRsvp, isPending } = useUpsertRsvp();

  const [selected, setSelected] = useState<RsvpStatus>('in');
  const [shareLocation, setShareLocation] = useState(false);
  const [locating, setLocating] = useState(false);

  async function submit() {
    let location: { latitude: number; longitude: number } | null = null;

    if (shareLocation && selected === 'in') {
      setLocating(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Location permission denied',
            'Barry needs location access to compute the meeting point. You can still RSVP without sharing your location.',
          );
          setShareLocation(false);
        } else {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          location = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        }
      } finally {
        setLocating(false);
      }
    }

    try {
      await upsertRsvp({
        ping_id: pingId,
        status: selected,
        location: location ?? undefined,
      });
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

      {ping && (
        <View style={styles.pingPreview}>
          <Text style={styles.pingMessage} numberOfLines={2}>{ping.message}</Text>
        </View>
      )}

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

      {selected === 'in' && (
        <View style={styles.locationRow}>
          <View style={styles.locationText}>
            <Text style={styles.locationTitle}>Share my location</Text>
            <Text style={styles.locationSubtitle}>
              Helps compute the best meeting point. Cleared once the meetup is confirmed.
            </Text>
          </View>
          <Switch
            value={shareLocation}
            onValueChange={setShareLocation}
            trackColor={{ true: colors.accent }}
            thumbColor={colors.text}
            accessibilityLabel="Share location toggle"
          />
        </View>
      )}

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
  pingPreview: {
    margin: 20,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pingMessage: { fontSize: 16, fontWeight: '600', color: colors.text },
  options: { paddingHorizontal: 20, gap: 10 },
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
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    margin: 20,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationText: { flex: 1 },
  locationTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  locationSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  footer: { flex: 1, justifyContent: 'flex-end', padding: 20 },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: 18,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.text, fontSize: 17, fontWeight: '600' },
});
