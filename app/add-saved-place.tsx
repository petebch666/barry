import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useSavePlace } from '@/hooks/useProfile';
import { useFavoritePlaces, useUpdateSavedPlace } from '@/hooks/useFavoritePlaces';
import { AddSavedPlaceSchema, UpdateSavedPlaceSchema } from '@/schemas';
import { reverseGeocode } from '@/utils/reverseGeocode';
import type { AddressSuggestion } from '@/utils/searchAddress';
import { colors, radii } from '@/lib/theme';
import PinMapPicker from '@/components/PinMapPicker';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';

const PARIS = { latitude: 48.8566, longitude: 2.3522 };
const CATEGORY_CHIPS = ['bar', 'restaurant', 'café', 'parc', 'autre'];

export default function AddSavedPlaceScreen() {
  const router = useRouter();
  const { placeId } = useLocalSearchParams<{ placeId?: string }>();
  const isEditing = !!placeId;
  const { mutateAsync: savePlace, isPending: isSaving } = useSavePlace();
  const { mutateAsync: updatePlace, isPending: isUpdating } = useUpdateSavedPlace();
  const { data: favoritePlaces } = useFavoritePlaces();
  const isPending = isSaving || isUpdating;

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState(PARIS);
  // On native, delay rendering PinMapPicker until we know the starting location.
  const [locationReady, setLocationReady] = useState(Platform.OS === 'web');
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const addressEditedByUser = useRef(false);
  const prefilled = useRef(false);

  // Prefill from the existing place when editing. Location isn't editable
  // (UpdateSavedPlaceSchema only covers name/address/category), so the
  // location-picking UI is hidden entirely in edit mode instead.
  useEffect(() => {
    if (!isEditing || prefilled.current || !favoritePlaces) return;
    const existing = favoritePlaces.find((p) => p.id === placeId);
    if (!existing) return;
    setName(existing.name);
    setAddress(existing.address ?? '');
    setCategory(existing.category ?? '');
    addressEditedByUser.current = true;
    prefilled.current = true;
  }, [isEditing, placeId, favoritePlaces]);

  useEffect(() => {
    if (Platform.OS === 'web' || isEditing) return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        }
      } catch {
        // Fall back to PARIS — already the default
      } finally {
        setLocationReady(true);
      }
    })();
  }, [isEditing]);

  async function handleLocationChange(loc: { latitude: number; longitude: number }) {
    setLocation(loc);
    if (addressEditedByUser.current) return;
    setIsGeocodingAddress(true);
    try {
      const addr = await reverseGeocode(loc.latitude, loc.longitude);
      if (addr && !addressEditedByUser.current) {
        setAddress(addr);
      }
    } finally {
      setIsGeocodingAddress(false);
    }
  }

  function handleAddressSelect(s: AddressSuggestion) {
    setAddress(s.label);
    setLocation({ latitude: s.latitude, longitude: s.longitude });
    // Deliberately leave addressEditedByUser false — a later pin drag
    // should still re-run reverseGeocode and auto-fill the address, same
    // as the GPS-then-drag flow already does.
  }

  async function submit() {
    if (isEditing) {
      const parsed = UpdateSavedPlaceSchema.safeParse({
        name: name.trim(),
        address: address.trim() || null,
        category: category.trim() || null,
      });
      if (!parsed.success) {
        Alert.alert('Invalid input', parsed.error.issues[0]?.message ?? 'Check your inputs.');
        return;
      }
      try {
        await updatePlace({ placeId: placeId!, updates: parsed.data });
        router.back();
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Could not update place.');
      }
      return;
    }

    const parsed = AddSavedPlaceSchema.safeParse({
      name: name.trim(),
      address: address.trim() || undefined,
      latitude: location.latitude,
      longitude: location.longitude,
      category: category.trim() || undefined,
    });

    if (!parsed.success) {
      Alert.alert('Invalid input', parsed.error.issues[0]?.message ?? 'Check your inputs.');
      return;
    }

    try {
      await savePlace({
        ...parsed.data,
        address: parsed.data.address ?? null,
        category: parsed.data.category ?? null,
        osm_id: null,
      });
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save place.');
    }
  }

  const canSubmit = !!name.trim();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{isEditing ? 'Edit Place' : 'Add Place'}</Text>
          <TouchableOpacity
            onPress={submit}
            disabled={isPending || !canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Save place"
          >
            {isPending ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={[styles.save, !canSubmit && styles.saveDisabled]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Le Bar du Coin"
            placeholderTextColor={colors.textTertiary}
            maxLength={200}
            autoFocus
            accessibilityLabel="Place name"
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.chips}>
            {CATEGORY_CHIPS.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategory(cat === category ? '' : cat)}
                style={[styles.chip, category === cat && styles.chipActive]}
                accessibilityRole="button"
                accessibilityLabel={cat}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            value={category}
            onChangeText={setCategory}
            placeholder="or type your own…"
            placeholderTextColor={colors.textTertiary}
            maxLength={100}
            accessibilityLabel="Category"
          />

          <View style={styles.addressLabelRow}>
            <Text style={styles.label}>Address</Text>
            {isGeocodingAddress && (
              <ActivityIndicator size="small" color={colors.textTertiary} />
            )}
          </View>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="Address"
              placeholderTextColor={colors.textTertiary}
              maxLength={500}
              accessibilityLabel="Address"
            />
          ) : (
            <AddressAutocomplete
              value={address}
              onChangeText={(t) => {
                addressEditedByUser.current = true;
                setAddress(t);
              }}
              onSelect={handleAddressSelect}
              placeholder="Search for an address…"
            />
          )}

          {isEditing ? (
            <Text style={styles.hint}>Location can't be changed after saving — remove and re-add the place if it moved.</Text>
          ) : (
            <>
              <Text style={styles.label}>Location</Text>
              <Text style={styles.hint}>Search for an address above, or drag the pin to fine-tune.</Text>
              {locationReady ? (
                <PinMapPicker
                  initialLocation={location}
                  onLocationChange={handleLocationChange}
                />
              ) : (
                <View style={styles.mapPlaceholder}>
                  <ActivityIndicator color={colors.accent} />
                </View>
              )}
            </>
          )}
        </ScrollView>
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
  save: { fontSize: 16, fontWeight: '600', color: colors.accent },
  saveDisabled: { color: colors.textTertiary },
  form: { padding: 20, gap: 4, paddingBottom: 40 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hint: { fontSize: 13, color: colors.textTertiary, marginBottom: 8 },
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(124,58,237,0.20)',
  },
  chipText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  chipTextActive: { color: colors.accent, fontWeight: '600' },
  mapPlaceholder: {
    height: 240,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 4,
  },
});
