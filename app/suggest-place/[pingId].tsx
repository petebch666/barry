import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSuggestPlace } from '@/hooks/usePlaces';
import { usePing } from '@/hooks/usePings';
import { useGroupFavoritePlaces } from '@/hooks/useFavoritePlaces';
import { GlassCard } from '@/components/GlassCard';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { colors, radii } from '@/lib/theme';

type Mode = 'favorites' | 'manual';

export default function SuggestPlaceModal() {
  const { pingId } = useLocalSearchParams<{ pingId: string }>();
  const router = useRouter();
  const { mutateAsync: suggestPlace, isPending } = useSuggestPlace();
  const { data: ping } = usePing(pingId);
  const { data: favoritePlaces = [] } = useGroupFavoritePlaces(ping?.group_id ?? '');

  const [mode, setMode] = useState<Mode>('manual');
  const [defaultModeSet, setDefaultModeSet] = useState(false);
  useEffect(() => {
    if (defaultModeSet || !ping) return;
    setMode(favoritePlaces.length > 0 ? 'favorites' : 'manual');
    setDefaultModeSet(true);
  }, [defaultModeSet, ping, favoritePlaces.length]);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [category, setCategory] = useState('');

  async function submit() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter the venue name.');
      return;
    }
    if (latitude == null || longitude == null) {
      Alert.alert('Address required', 'Search and select an address.');
      return;
    }

    try {
      await suggestPlace({
        ping_id: pingId,
        name: name.trim(),
        address: address.trim() || undefined,
        latitude,
        longitude,
        category: category.trim() || undefined,
      });
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not add place.');
    }
  }

  async function submitFavorite(place: { name: string; address: string | null; latitude: number; longitude: number; category: string | null }) {
    try {
      await suggestPlace({
        ping_id: pingId,
        name: place.name,
        address: place.address ?? undefined,
        latitude: place.latitude,
        longitude: place.longitude,
        category: place.category ?? undefined,
      });
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not add place.');
    }
  }

  const canAdd = !!name.trim();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Suggest a Place</Text>
          {mode === 'manual' ? (
            <TouchableOpacity
              onPress={submit}
              disabled={isPending || !canAdd}
              accessibilityRole="button"
              accessibilityLabel="Add place"
            >
              {isPending ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={[styles.add, !canAdd && styles.addDisabled]}>Add</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeChip, mode === 'favorites' && styles.modeChipActive]}
            onPress={() => setMode('favorites')}
            accessibilityRole="button"
            accessibilityLabel="From your favorites"
          >
            <Text style={[styles.modeChipText, mode === 'favorites' && styles.modeChipTextActive]}>
              From your favorites
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeChip, mode === 'manual' && styles.modeChipActive]}
            onPress={() => setMode('manual')}
            accessibilityRole="button"
            accessibilityLabel="Manual entry"
          >
            <Text style={[styles.modeChipText, mode === 'manual' && styles.modeChipTextActive]}>
              Manual entry
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'favorites' ? (
          <ScrollView contentContainerStyle={styles.form}>
            {favoritePlaces.length === 0 ? (
              <View style={styles.tipBox}>
                <Text style={styles.tip}>
                  No favorite places saved by your group yet — switch to manual entry, or add one from the Places tab.
                </Text>
              </View>
            ) : (
              favoritePlaces.map((place) => (
                <TouchableOpacity
                  key={place.id}
                  onPress={() => submitFavorite(place)}
                  disabled={isPending}
                  accessibilityRole="button"
                  accessibilityLabel={`Suggest ${place.name}`}
                  activeOpacity={0.75}
                >
                  <GlassCard style={styles.favoriteRow}>
                    <View style={styles.favoriteInfo}>
                      <Text style={styles.favoriteName}>{place.name}</Text>
                      {place.address && (
                        <Text style={styles.favoriteAddress} numberOfLines={1}>{place.address}</Text>
                      )}
                      <Text style={styles.favoriteAttribution}>
                        Added by {place.profiles?.display_name ?? 'a group member'}
                      </Text>
                    </View>
                  </GlassCard>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <View style={styles.tipBox}>
              <Text style={styles.tip}>
                Search for the address below and pick a match.
              </Text>
            </View>

            <Text style={styles.label}>Venue name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Le Bar du Coin"
              placeholderTextColor={colors.textTertiary}
              maxLength={200}
              autoFocus
              accessibilityLabel="Venue name"
            />

            <Text style={styles.label}>Address *</Text>
            <AddressAutocomplete
              value={address}
              onChangeText={setAddress}
              onSelect={(s) => {
                setAddress(s.label);
                setLatitude(s.latitude);
                setLongitude(s.longitude);
              }}
              placeholder="Search for an address…"
            />

            <Text style={styles.label}>Category</Text>
            <TextInput
              style={styles.input}
              value={category}
              onChangeText={setCategory}
              placeholder="bar / restaurant / café…"
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Category"
            />
          </ScrollView>
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
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
  add: { fontSize: 16, fontWeight: '600', color: colors.accent },
  addDisabled: { color: colors.textTertiary },
  modeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 16 },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modeChipActive: { borderColor: colors.accent, backgroundColor: 'rgba(124,58,237,0.20)' },
  modeChipText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  modeChipTextActive: { color: colors.accent },
  favoriteRow: { padding: 14, gap: 4 },
  favoriteInfo: { gap: 2 },
  favoriteName: { fontSize: 16, fontWeight: '700', color: colors.text },
  favoriteAddress: { fontSize: 13, color: colors.textSecondary },
  favoriteAttribution: { fontSize: 12, color: colors.textTertiary },
  form: { padding: 20, gap: 6 },
  tipBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginTop: 4,
  },
  tip: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
});
