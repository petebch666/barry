import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

// Placeholder — wired up in Phase 3
export default function GroupsListScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Groups</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/create-group')}
          accessibilityRole="button"
          accessibilityLabel="Create a group"
        >
          <Text style={styles.addButtonText}>+ Group</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No groups yet.</Text>
        <Text style={styles.emptySubtext}>Create a group to start pinging your friends.</Text>
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
  addButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#1E293B', marginBottom: 8 },
  emptySubtext: { fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 22 },
});
