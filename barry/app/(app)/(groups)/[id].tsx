import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroup, useGroupMembers, useInviteLink } from '@/hooks/useGroups';
import { useGroupPings } from '@/hooks/usePings';
import type { Ping } from '@/schemas';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: group, isLoading: groupLoading } = useGroup(id);
  const { data: members = [], isLoading: membersLoading } = useGroupMembers(id);
  const { data: pings = [], isLoading: pingsLoading } = useGroupPings(id);
  const { data: inviteLink } = useInviteLink(id);

  async function shareInvite() {
    if (!inviteLink) return;
    try {
      await Share.share({
        message: `Join my group "${group?.name}" on Barry: ${inviteLink}`,
        url: inviteLink,
      });
    } catch {
      Alert.alert('Could not share', 'Please try again.');
    }
  }

  if (groupLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator color="#6366F1" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Group not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activePings = pings.filter((p) => p.status === 'open' || p.status === 'voting');
  const pastPings = pings.filter((p) => p.status === 'confirmed' || p.status === 'cancelled');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={[]}
        keyExtractor={() => ''}
        renderItem={null}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Text style={styles.backText}>‹ Back</Text>
              </TouchableOpacity>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={shareInvite}
                  accessibilityRole="button"
                  accessibilityLabel="Share invite link"
                >
                  <Text style={styles.actionButtonText}>Invite</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonPrimary]}
                  onPress={() => router.push('/create-ping')}
                  accessibilityRole="button"
                  accessibilityLabel="Send a ping to this group"
                >
                  <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>Ping!</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Group info */}
            <View style={styles.groupInfo}>
              <View style={styles.groupAvatar}>
                <Text style={styles.groupAvatarText}>{group.name[0].toUpperCase()}</Text>
              </View>
              <Text style={styles.groupName}>{group.name}</Text>
              {group.description ? (
                <Text style={styles.groupDescription}>{group.description}</Text>
              ) : null}
            </View>

            {/* Members strip */}
            <View style={styles.membersSection}>
              <Text style={styles.sectionTitle}>
                {membersLoading ? 'Members' : `Members (${members.length})`}
              </Text>
              {membersLoading ? (
                <ActivityIndicator color="#6366F1" />
              ) : (
                <View style={styles.membersRow}>
                  {members.slice(0, 8).map((m: { user_id: string; profiles?: { display_name?: string } }) => (
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
            </View>

            {/* Active pings */}
            {activePings.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Active pings</Text>
              </View>
            )}
          </>
        }
        ListFooterComponent={
          <>
            {pingsLoading && <ActivityIndicator color="#6366F1" style={{ marginVertical: 24 }} />}

            {/* Active pings list */}
            {activePings.map((ping) => (
              <PingRow key={ping.id} ping={ping} />
            ))}

            {/* Past pings */}
            {pastPings.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Past meetups</Text>
                {pastPings.slice(0, 5).map((ping) => (
                  <PingRow key={ping.id} ping={ping} />
                ))}
              </View>
            )}

            {!pingsLoading && pings.length === 0 && (
              <View style={styles.emptyPings}>
                <Text style={styles.emptyText}>No pings yet.</Text>
                <Text style={styles.emptyHint}>Tap Ping! to invite the group out.</Text>
              </View>
            )}
          </>
        }
      />
    </SafeAreaView>
  );
}

function PingRow({ ping }: { ping: Ping }) {
  const router = useRouter();

  const STATUS_COLORS: Record<string, string> = {
    open: '#3B82F6',
    voting: '#F59E0B',
    confirmed: '#10B981',
    cancelled: '#94A3B8',
  };

  return (
    <TouchableOpacity
      style={styles.pingRow}
      onPress={() => router.push(`/(app)/(feed)/ping/${ping.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open ping: ${ping.message}`}
    >
      <View style={[styles.pingStatus, { backgroundColor: STATUS_COLORS[ping.status] ?? '#94A3B8' }]} />
      <View style={styles.pingContent}>
        <Text style={styles.pingMessage} numberOfLines={2}>{ping.message}</Text>
        <Text style={styles.pingMeta}>{ping.status.toUpperCase()}</Text>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: { paddingVertical: 4 },
  backText: { fontSize: 17, color: '#6366F1', fontWeight: '500' },
  headerActions: { flexDirection: 'row', gap: 8 },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#6366F1',
  },
  actionButtonPrimary: { backgroundColor: '#6366F1' },
  actionButtonText: { fontSize: 14, fontWeight: '600', color: '#6366F1' },
  actionButtonTextPrimary: { color: '#FFF' },

  groupInfo: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  groupAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  groupAvatarText: { fontSize: 30, fontWeight: '700', color: '#6366F1' },
  groupName: { fontSize: 22, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
  groupDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },

  membersSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  membersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  memberChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberChipMore: { backgroundColor: '#E2E8F0' },
  memberInitial: { fontSize: 15, fontWeight: '700', color: '#6366F1' },
  memberInitialMore: { fontSize: 13, fontWeight: '600', color: '#64748B' },

  section: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8 },

  pingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pingStatus: { width: 8, height: 8, borderRadius: 4 },
  pingContent: { flex: 1 },
  pingMessage: { fontSize: 15, color: '#1E293B', fontWeight: '500' },
  pingMeta: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 4, letterSpacing: 0.5 },
  chevron: { fontSize: 20, color: '#CBD5E1' },

  emptyPings: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#1E293B', marginBottom: 6 },
  emptyHint: { fontSize: 14, color: '#64748B' },

  errorBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#EF4444' },
});
