import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useProfile, useSavedPlaces } from '@/hooks/useProfile';
import { deregisterPushToken } from '@/hooks/usePushToken';
import type { SavedPlace } from '@/schemas';

export default function ProfileScreen() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: savedPlaces = [], isLoading: placesLoading } = useSavedPlaces();

  async function signOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          // Deregister push token before signing out so we stop receiving notifications
          await deregisterPushToken();
          await supabase.removeAllChannels();
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  const initials = profile?.display_name
    ? profile.display_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Profile</Text>
      </View>

      {/* Avatar + name */}
      <View style={styles.avatarRow}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
        <View style={styles.nameBlock}>
          {profileLoading ? (
            <ActivityIndicator color="#6366F1" />
          ) : (
            <>
              <Text style={styles.displayName}>{profile?.display_name ?? '—'}</Text>
            </>
          )}
        </View>
      </View>

      {/* Saved places */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Saved places</Text>
        <Text style={styles.sectionSubtitle}>
          Starred venues are suggested to your groups when planning meetups.
        </Text>
      </View>

      {placesLoading ? (
        <ActivityIndicator color="#6366F1" style={{ marginTop: 24 }} />
      ) : savedPlaces.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No saved places yet.</Text>
          <Text style={styles.emptyHint}>
            Star a venue on the map or during a ping to add it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={savedPlaces}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <SavedPlaceCard place={item} />}
        />
      )}

      {/* Sign out */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={signOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function SavedPlaceCard({ place }: { place: SavedPlace }) {
  return (
    <View style={styles.placeCard}>
      <View style={styles.placeIcon}>
        <Text style={styles.placeIconText}>📍</Text>
      </View>
      <View style={styles.placeInfo}>
        <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
        {place.address ? (
          <Text style={styles.placeAddress} numberOfLines={1}>{place.address}</Text>
        ) : null}
        {place.category ? (
          <Text style={styles.placeCategory}>{place.category}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  heading: { fontSize: 28, fontWeight: '700', color: '#1E293B' },

  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 14,
  },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarPlaceholder: {
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { color: '#FFF', fontSize: 22, fontWeight: '700' },
  nameBlock: { flex: 1 },
  displayName: { fontSize: 18, fontWeight: '600', color: '#1E293B' },

  sectionHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: '#64748B', lineHeight: 18 },

  listContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20 },

  empty: { paddingHorizontal: 20, paddingTop: 16 },
  emptyText: { fontSize: 15, color: '#64748B' },
  emptyHint: { fontSize: 13, color: '#94A3B8', marginTop: 4, lineHeight: 18 },

  placeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  placeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeIconText: { fontSize: 18 },
  placeInfo: { flex: 1 },
  placeName: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  placeAddress: { fontSize: 13, color: '#64748B', marginTop: 2 },
  placeCategory: {
    fontSize: 11,
    color: '#6366F1',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },

  footer: { padding: 20 },
  signOutButton: {
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
});
