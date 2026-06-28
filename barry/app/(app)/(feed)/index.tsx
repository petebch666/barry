import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFeedPings } from '@/hooks/usePings';
import { GlassCard } from '@/components/GlassCard';
import { Badge } from '@/components/Badge';
import { colors, BOTTOM_TAB_PADDING } from '@/lib/theme';
import type { Ping } from '@/schemas';

export default function FeedScreen() {
  const router = useRouter();
  const { data: pings, isLoading, refetch, isRefetching } = useFeedPings();

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.heading}>Feed</Text>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => router.push('/create-ping')}
            accessibilityRole="button"
            accessibilityLabel="Send a ping"
          >
            <Text style={styles.fabText}>+ Ping</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={pings ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
          renderItem={({ item }) => <PingCard ping={item} />}
          ListEmptyComponent={
            isLoading ? null : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No active pings</Text>
                <Text style={styles.emptyHint}>
                  Tap "+ Ping" to let your friends know you're available.
                </Text>
              </View>
            )
          }
        />
      </SafeAreaView>
    </View>
  );
}

function PingCard({ ping }: { ping: Ping & { groups?: { name: string } } }) {
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(app)/(feed)/ping/${ping.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Ping: ${ping.message}`}
      activeOpacity={0.75}
    >
      <GlassCard style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.groupName} numberOfLines={1}>
            {(ping as any).groups?.name ?? 'Group'}
          </Text>
          <Badge status={ping.status} />
        </View>
        <Text style={styles.message} numberOfLines={2}>{ping.message}</Text>
        {ping.proposed_time && (
          <Text style={styles.time}>
            {new Date(ping.proposed_time).toLocaleString(undefined, {
              weekday: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        )}
      </GlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  heading: { fontSize: 34, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  fab: {
    backgroundColor: colors.accent,
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  fabText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  list: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: BOTTOM_TAB_PADDING,
    gap: 10,
  },
  card: { padding: 16, gap: 8 },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupName: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  message: { fontSize: 17, fontWeight: '600', color: colors.text, lineHeight: 22 },
  time: { fontSize: 13, color: colors.textTertiary },
  empty: { paddingTop: 80, alignItems: 'center', paddingHorizontal: 40 },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 15,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
