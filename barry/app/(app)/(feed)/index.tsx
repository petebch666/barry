import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

// Placeholder — replaced in Phase 3 when hooks are wired up
export default function FeedScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Feed</Text>
        <TouchableOpacity
          style={styles.pingButton}
          onPress={() => router.push('/create-ping')}
          accessibilityRole="button"
          accessibilityLabel="Send a ping"
        >
          <Text style={styles.pingButtonText}>+ Ping</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No active pings yet.</Text>
        <Text style={styles.emptySubtext}>Tap "Ping" to let your friends know you're available.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  heading: { fontSize: 28, fontWeight: '700', color: '#1E293B' },
  pingButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pingButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#1E293B', marginBottom: 8 },
  emptySubtext: { fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 22 },
});
