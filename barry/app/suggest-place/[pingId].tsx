import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSuggestPlace } from '@/hooks/usePlaces';

export default function SuggestPlaceModal() {
  const { pingId } = useLocalSearchParams<{ pingId: string }>();
  const router = useRouter();
  const { mutateAsync: suggestPlace, isPending } = useSuggestPlace();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [category, setCategory] = useState('');

  async function submit() {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter the venue name.');
      return;
    }
    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('Coordinates required', 'Enter valid latitude and longitude.');
      return;
    }

    try {
      await suggestPlace({
        ping_id: pingId,
        name: name.trim(),
        address: address.trim() || undefined,
        latitude: lat,
        longitude: lng,
        category: category.trim() || undefined,
      });
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not add place.');
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Suggest a Place</Text>
          <TouchableOpacity
            onPress={submit}
            disabled={isPending || !name.trim()}
            accessibilityRole="button"
            accessibilityLabel="Add place"
          >
            {isPending ? (
              <ActivityIndicator color="#3B82F6" />
            ) : (
              <Text style={[styles.add, !name.trim() && styles.addDisabled]}>Add</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>
            Tip: Open Google Maps, find the place, tap "Share" → copy the coordinates.
          </Text>

          <Text style={styles.label}>Venue name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder="Le Bar du Coin" placeholderTextColor="#94A3B8" maxLength={200}
            autoFocus accessibilityLabel="Venue name" />

          <Text style={styles.label}>Address</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress}
            placeholder="12 rue de Rivoli, Paris" placeholderTextColor="#94A3B8"
            accessibilityLabel="Address" />

          <Text style={styles.label}>Category</Text>
          <TextInput style={styles.input} value={category} onChangeText={setCategory}
            placeholder="bar / restaurant / café…" placeholderTextColor="#94A3B8"
            accessibilityLabel="Category" />

          <View style={styles.coordRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Latitude *</Text>
              <TextInput style={styles.input} value={latitude} onChangeText={setLatitude}
                placeholder="48.8566" placeholderTextColor="#94A3B8" keyboardType="decimal-pad"
                accessibilityLabel="Latitude" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Longitude *</Text>
              <TextInput style={styles.input} value={longitude} onChangeText={setLongitude}
                placeholder="2.3522" placeholderTextColor="#94A3B8" keyboardType="decimal-pad"
                accessibilityLabel="Longitude" />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  cancel: { fontSize: 16, color: '#64748B' },
  title: { fontSize: 17, fontWeight: '600', color: '#1E293B' },
  add: { fontSize: 16, fontWeight: '600', color: '#3B82F6' },
  addDisabled: { color: '#CBD5E1' },
  form: { padding: 20, gap: 6 },
  hint: {
    fontSize: 13, color: '#64748B', backgroundColor: '#F1F5F9',
    borderRadius: 8, padding: 12, lineHeight: 18,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#64748B', marginTop: 16, marginBottom: 4 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E2E8F0',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#1E293B',
  },
  coordRow: { flexDirection: 'row', gap: 12 },
});
