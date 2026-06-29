import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroup, useGroupMembers } from '@/hooks/useGroups';
import { useGroupPings } from '@/hooks/usePings';
import { GlassCard } from '@/components/GlassCard';
import { Badge } from '@/components/Badge';
import { colors, BOTTOM_TAB_PADDING } from '@/lib/theme';
import type { Ping } from '@/schemas';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: group, isLoading: groupLoading } = useGroup(id);
  const { data: members = [], isLoading: membersLoading } = useGroupMembers(id);
  const { data: pings = [], isLoading: pingsLoading } = useGroupPings(id);

  if (groupLoading) {
    return (
      <View style={styles.root}>
        <ActivityIndicator color={colors.accent} style={{ flex: 1 }} />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.container}>
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backText}>‹ Back</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={styles.errorText}>Group not found</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const activePings = pings.filter((p) => p.status === 'open' || p.status === 'voting');
  const pastPings = pings.filter((p) => p.status === 'confirmed' || p.status === 'cancelled');

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <FlatList
          data={[]}
          keyExtractor={() => ''}
          renderItem={null}
          ListHeaderComponent={
            <>
              {/* Nav */}
              <View style={styles.navBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                  <Text style={styles.backText}>‹ Back</Text>
                </TouchableOpacity>
                <View style={styles.headerActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => router.push(`/invite/${id}` as never)}
                    accessibilityRole="button"
                    accessibilityLabel="Share invite link"
                  >
                    <Text style={styles.actionBtnText}>Invite</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnPrimary]}
                    onPress={() => router.push('/create-ping')}
                    accessibilityRole="button"
                    accessibilityLabel="Send a ping"
                  >
                    <Text style={[styles.actionBtnText, { color: colors.text }]}>Ping!</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Group header */}
              <GlassCard style={styles.groupCard}>
                <View style={styles.groupAvatar}>
                  <Text style={styles.groupAvatarText}>{group.name[0].toUpperCase()}</Text>
                </View>
                <Text style={styles.groupName}>{group.name}</Text>
                {group.description ? (
                  <Text style={styles.groupDesc}>{group.description}</Text>
                ) : null}
              </GlassCard>

              {/* Members strip */}
              <GlassCard style={styles.membersCard}>
                <View style={styles.membersHeader}>
                  <Text style={styles.membersTitle}>
                    {membersLoading ? 'Members' : `Members · ${members.length}`}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push(`/(app)/(groups)/${id}/members` as never)}
                    accessibilityRole="button"
                    accessibilityLabel="Manage members"
                  >
                    <Text style={styles.manageLink}>Manage ›</Text>
                  </TouchableOpacity>
                </View>
                {membersLoading ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <View style={styles.membersRow}>
                    {(members as any[]).slice(0, 8).map((m) => (
                      <View key={m.user_id} style={styles.memberChip}>
                        <Text style={styles.memberInitial}>
                          {m.profiles?.display_name?.[0]?.toUpperCase() ?? '?'}
                        </Text>
                      </View>
                    ))}
                    {members.length > 8 && (
                      <View style={[styles.memberChip, styles.memberChipMore]}>
                        <Text style={styles.memberInitialMore}>+{members.length - 8}</Text>
                      </View>
                    )}
                  </View>
                )}
              </GlassCard>

              {activePings.length > 0 && (
                <Text style={styles.sectionLabel}>ACTIVE PINGS</Text>
              )}
            </>
          }
          ListFooterComponent={
            <>
              {pingsLoading && (
                <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
              )}

              {activePings.map((ping) => (
                <PingRow key={ping.id} ping={ping} />
              ))}

              {pastPings.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: 16 }]}>PAST MEETUPS</Text>
                  {pastPings.slice(0, 5).map((ping) => (
                    <PingRow key={ping.id} ping={ping} />
                  ))}
                </>
              )}

              {!pingsLoading && pings.length === 0 && (
                <View style={styles.emptyPings}>
                  <Text style={styles.emptyText}>No pings yet</Text>
                  <Text style={styles.emptyHint}>Tap Ping! to invite the group out.</Text>
                </View>
              )}

              <View style={{ height: BOTTOM_TAB_PADDING }} />
            </>
          }
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
    </View>
  );
}

function PingRow({ ping }: { ping: Ping }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push(`/(app)/(feed)/ping/${ping.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open ping: ${ping.message}`}
      activeOpacity={0.75}
      style={styles.pingRowWrap}
    >
      <GlassCard style={styles.pingRow}>
        <Badge status={ping.status} />
        <Text style={styles.pingMessage} numberOfLines={2}>{ping.message}</Text>
        <Text style={styles.pingChevron}>›</Text>
      </GlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  listContent: { paddingHorizontal: 16 },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  backBtn: { paddingVertical: 4 },
  backText: { fontSize: 17, color: colors.accent, fontWeight: '500' },
  headerActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  actionBtnPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  actionBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  groupCard: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  groupAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  groupAvatarText: { fontSize: 26, fontWeight: '700', color: colors.accent },
  groupName: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
  groupDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  membersCard: { padding: 16, gap: 10, marginBottom: 10 },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  membersTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  manageLink: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  membersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberChipMore: { backgroundColor: colors.surface },
  memberInitial: { fontSize: 14, fontWeight: '700', color: colors.accent },
  memberInitialMore: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  pingRowWrap: { marginBottom: 8 },
  pingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  pingMessage: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '500' },
  pingChevron: { fontSize: 20, color: colors.textTertiary },
  emptyPings: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  emptyHint: { fontSize: 14, color: colors.textTertiary },
  errorText: { fontSize: 16, color: colors.error },
});
