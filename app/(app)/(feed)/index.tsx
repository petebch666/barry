import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFeedPings } from '@/hooks/usePings';
import { useGroups } from '@/hooks/useGroups';
import { GlassCard } from '@/components/GlassCard';
import { Badge } from '@/components/Badge';
import { colors, BOTTOM_TAB_PADDING } from '@/lib/theme';
import type { Ping } from '@/schemas';

export default function FeedScreen() {
  const router = useRouter();
  const { data: pings, isLoading, refetch, isRefetching } = useFeedPings();
  const { data: groups, isLoading: groupsLoading } = useGroups();

  const hasGroups = (groups?.length ?? 0) > 0;
  const initialized = !isLoading && !groupsLoading;

  function handlePingPress() {
    router.push('/create-ping');
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>

        {/* ── Top half: ping tiles ─────────────────────────────────── */}
        <View style={styles.pingsSection}>
          <FlatList
            data={pings ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
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
              initialized ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>No pings yet</Text>
                  <Text style={styles.emptyHint}>
                    {hasGroups
                      ? 'Tap the button below to send the first ping.'
                      : 'Create a group and send your first ping.'}
                  </Text>
                </View>
              ) : null
            }
          />
        </View>

        {/* ── Bottom half: ping orb ────────────────────────────────── */}
        <View style={styles.orbSection}>
          {initialized && !hasGroups && (
            <Text style={styles.noGroupHint}>
              You're not in any group yet.{' '}
              <Text
                style={styles.noGroupLink}
                onPress={() => router.push('/create-group')}
              >
                Create one →
              </Text>
            </Text>
          )}

          <TouchableOpacity
            style={[styles.orb, !hasGroups && initialized && styles.orbDim]}
            onPress={hasGroups ? handlePingPress : () => router.push('/create-group')}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={hasGroups ? 'Send a ping' : 'Create your first group'}
          >
            <Text style={styles.orbIcon}>◎</Text>
            <Text style={styles.orbLabel}>{hasGroups ? 'Ping' : 'Create group'}</Text>
          </TouchableOpacity>

          {initialized && hasGroups && (
            <Text style={styles.orbHint}>Tap to ping your crew</Text>
          )}
        </View>

      </SafeAreaView>
    </View>
  );
}

// ─── Ping card ────────────────────────────────────────────────────────────────

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

// ─── Styles ───────────────────────────────────────────────────────────────────

const ORB_SIZE = 96;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safeArea: { flex: 1 },

  // ── Top section ──────────────────────────────────────────────────────────
  pingsSection: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listContent: {
    padding: 12,
    gap: 10,
    flexGrow: 1,
  },

  // ── Bottom section ───────────────────────────────────────────────────────
  orbSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingBottom: BOTTOM_TAB_PADDING,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 12,
  },
  orbDim: {
    backgroundColor: colors.surface,
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  orbIcon: { fontSize: 28, color: colors.text, lineHeight: 32 },
  orbLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  orbHint: { fontSize: 14, color: colors.textTertiary },

  // ── No-group callout ─────────────────────────────────────────────────────
  noGroupHint: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
  noGroupLink: { fontSize: 14, fontWeight: '600', color: colors.accent },

  // ── Ping list ────────────────────────────────────────────────────────────
  card: { padding: 16, gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupName: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  message: { fontSize: 17, fontWeight: '600', color: colors.text, lineHeight: 22 },
  time: { fontSize: 13, color: colors.textTertiary },

  // ── Empty state ──────────────────────────────────────────────────────────
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.textTertiary, marginBottom: 6 },
  emptyHint: { fontSize: 14, color: colors.textTertiary, textAlign: 'center', lineHeight: 20 },
});
