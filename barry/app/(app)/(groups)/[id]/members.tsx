import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useGroupMembers,
  useUpdateMemberRole,
  useRemoveMember,
} from '@/hooks/useGroups';
import { useProfile } from '@/hooks/useProfile';

type Member = {
  user_id: string;
  role: string;
  joined_at: string;
  profiles?: { id: string; display_name?: string; avatar_url?: string } | null;
};

export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: profile } = useProfile();
  const { data: members = [], isLoading } = useGroupMembers(id);
  const { mutateAsync: updateRole, isPending: updatingRole } = useUpdateMemberRole(id);
  const { mutateAsync: removeMember, isPending: removing } = useRemoveMember(id);

  const currentUserId = profile?.id;
  const typedMembers = members as Member[];
  const currentMember = typedMembers.find((m) => m.user_id === currentUserId);
  const isAdmin = currentMember?.role === 'admin';
  const adminCount = typedMembers.filter((m) => m.role === 'admin').length;

  function confirmRemove(member: Member) {
    const isSelf = member.user_id === currentUserId;

    if (isSelf && isAdmin && adminCount === 1) {
      Alert.alert('Cannot leave', 'You are the only admin. Promote another member before leaving.');
      return;
    }

    const displayName = member.profiles?.display_name ?? 'this member';
    Alert.alert(
      isSelf ? 'Leave group?' : `Remove ${displayName}?`,
      isSelf
        ? 'You will lose access to this group and all its pings.'
        : `${displayName} will lose access to the group.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isSelf ? 'Leave' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember(member.user_id);
              if (isSelf) router.replace('/(app)/(groups)');
            } catch {
              Alert.alert('Error', 'Could not complete the action. Please try again.');
            }
          },
        },
      ],
    );
  }

  function confirmRoleChange(member: Member) {
    const newRole: 'admin' | 'member' = member.role === 'admin' ? 'member' : 'admin';
    const displayName = member.profiles?.display_name ?? 'This member';
    const label = newRole === 'admin' ? 'Make admin' : 'Remove admin';

    Alert.alert(
      label,
      newRole === 'admin'
        ? `${displayName} will be able to manage the group and its members.`
        : `${displayName} will become a regular member.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: label,
          onPress: async () => {
            try {
              await updateRole({ userId: member.user_id, role: newRole });
            } catch {
              Alert.alert('Error', 'Could not update role. Please try again.');
            }
          },
        },
      ],
    );
  }

  const isBusy = updatingRole || removing;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Members</Text>
        <TouchableOpacity
          onPress={() => router.push(`/invite/${id}` as never)}
          style={styles.inviteButton}
          accessibilityRole="button"
          accessibilityLabel="Invite members"
        >
          <Text style={styles.inviteText}>Invite</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#6366F1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={typedMembers}
          keyExtractor={(m) => m.user_id}
          contentContainerStyle={styles.list}
          renderItem={({ item: member }) => {
            const isSelf = member.user_id === currentUserId;
            const isLastAdmin = member.role === 'admin' && adminCount === 1;
            const canManageOther = isAdmin && !isSelf;

            return (
              <View style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarInitial}>
                    {member.profiles?.display_name?.[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>

                <View style={styles.info}>
                  <Text style={styles.name}>
                    {member.profiles?.display_name ?? 'Unknown'}
                    {isSelf ? ' (you)' : ''}
                  </Text>
                  <View style={[styles.badge, member.role === 'admin' && styles.badgeAdmin]}>
                    <Text style={[styles.badgeText, member.role === 'admin' && styles.badgeTextAdmin]}>
                      {member.role === 'admin' ? 'Admin' : 'Member'}
                    </Text>
                  </View>
                </View>

                <View style={styles.actions}>
                  {/* Admins can toggle roles of other members, unless they'd be removing the last admin */}
                  {canManageOther && !isLastAdmin && (
                    <TouchableOpacity
                      onPress={() => confirmRoleChange(member)}
                      style={styles.actionBtn}
                      disabled={isBusy}
                      accessibilityRole="button"
                      accessibilityLabel={member.role === 'admin' ? 'Remove admin role' : 'Make admin'}
                    >
                      <Text style={styles.actionBtnText}>
                        {member.role === 'admin' ? 'Demote' : 'Admin'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Admins can remove others; anyone can leave their own group */}
                  {(canManageOther || isSelf) && (
                    <TouchableOpacity
                      onPress={() => confirmRemove(member)}
                      style={[styles.actionBtn, styles.actionBtnDanger]}
                      disabled={isBusy}
                      accessibilityRole="button"
                      accessibilityLabel={isSelf ? 'Leave group' : 'Remove member'}
                    >
                      <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>
                        {isSelf ? 'Leave' : 'Remove'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: { paddingVertical: 4 },
  backText: { fontSize: 17, color: '#6366F1', fontWeight: '500' },
  title: { fontSize: 17, fontWeight: '600', color: '#1E293B' },
  inviteButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#6366F1',
  },
  inviteText: { fontSize: 14, fontWeight: '600', color: '#6366F1' },

  list: { paddingTop: 8, paddingBottom: 32 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitial: { fontSize: 17, fontWeight: '700', color: '#6366F1' },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontWeight: '500', color: '#1E293B' },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  badgeAdmin: { backgroundColor: '#EEF2FF' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#64748B', letterSpacing: 0.3 },
  badgeTextAdmin: { color: '#6366F1' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  actionBtnDanger: { borderColor: '#FCA5A5' },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  actionBtnTextDanger: { color: '#EF4444' },
});
