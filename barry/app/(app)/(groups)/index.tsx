import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroups } from '@/hooks/useGroups';
import type { Group } from '@/schemas';

export default function GroupsListScreen() {
  const router = useRouter();
  const { data: groups, isLoading, refetch, isRefetching } = useGroups();

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

      <FlatList
        data={groups ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#3B82F6" />
        }
        renderItem={({ item }) => <GroupCard group={item} />}
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No groups yet.</Text>
              <Text style={styles.emptySubtext}>
                Create a group or ask a friend to share an invite link.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function GroupCard({ group }: { group: Group }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(app)/(groups)/${group.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open group: ${group.name}`}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{group.name[0].toUpperCase()}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.groupName}>{group.name}</Text>
        {group.description ? (
          <Text style={styles.description} numberOfLines={1}>{group.description}</Text>
        ) : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
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
  list: { padding: 16, gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#3B82F6' },
  cardBody: { flex: 1 },
  groupName: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  description: { fontSize: 13, color: '#64748B', marginTop: 2 },
  chevron: { fontSize: 20, color: '#CBD5E1' },
  empty: { paddingTop: 80, alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#1E293B', marginBottom: 8 },
  emptySubtext: { fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 22 },
});
