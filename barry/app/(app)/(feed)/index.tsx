import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFeedPings } from '@/hooks/usePings';
import type { Ping } from '@/schemas';

export default function FeedScreen() {
  const router = useRouter();
  const { data: pings, isLoading, refetch, isRefetching } = useFeedPings();

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

      <FlatList
        data={pings ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#3B82F6" />
        }
        renderItem={({ item }) => <PingCard ping={item} />}
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No active pings.</Text>
              <Text style={styles.emptySubtext}>
                Tap "+ Ping" to let your friends know you're available.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function PingCard({ ping }: { ping: Ping & { groups?: { name: string } } }) {
  const router = useRouter();
  const statusColor: Record<string, string> = {
    open: '#3B82F6',
    voting: '#F59E0B',
    confirmed: '#10B981',
    cancelled: '#94A3B8',
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(app)/(feed)/ping/${ping.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Ping: ${ping.message}`}
    >
      <View style={styles.cardTop}>
        <Text style={styles.groupName}>{(ping as any).groups?.name ?? 'Group'}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor[ping.status] + '22' }]}>
          <Text style={[styles.badgeText, { color: statusColor[ping.status] }]}>
            {ping.status}
          </Text>
        </View>
      </View>
      <Text style={styles.message}>{ping.message}</Text>
      {ping.proposed_time && (
        <Text style={styles.time}>
          {new Date(ping.proposed_time).toLocaleString(undefined, {
            weekday: 'short', hour: '2-digit', minute: '2-digit',
          })}
        </Text>
      )}
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
  pingButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pingButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupName: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  message: { fontSize: 17, fontWeight: '600', color: '#1E293B' },
  time: { fontSize: 13, color: '#64748B' },
  empty: { paddingTop: 80, alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#1E293B', marginBottom: 8 },
  emptySubtext: { fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 22 },
});
