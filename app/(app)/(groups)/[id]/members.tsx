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
import { useGroupMembers, useUpdateMemberRole, useRemoveMember } from '@/hooks/useGroups';
import { useProfile } from '@/hooks/useProfile';
import { GlassCard } from '@/components/GlassCard';
import { colors, BOTTOM_TAB_PADDING } from '@/lib/theme';

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
              if (isSelf) router.replace('/(app)/(profile)');
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
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Members</Text>
          <TouchableOpacity
            onPress={() => router.push(`/invite/${id}` as never)}
            style={styles.inviteBtn}
            accessibilityRole="button"
            accessibilityLabel="Invite members"
          >
            <Text style={styles.inviteBtnText}>Invite</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={typedMembers}
            keyExtractor={(m) => m.user_id}
            contentContainerStyle={styles.list}
            renderItem={({ item: member }) => {
              const isSelf = member.user_id === currentUserId;
              const canManageOther = isAdmin && !isSelf;
              const isLastAdmin = member.role === 'admin' && adminCount === 1;

              return (
                <GlassCard style={styles.row}>
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
                    <View style={[styles.roleBadge, member.role === 'admin' && styles.roleBadgeAdmin]}>
                      <Text style={[styles.roleText, member.role === 'admin' && styles.roleTextAdmin]}>
                        {member.role === 'admin' ? 'Admin' : 'Member'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actions}>
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
                </GlassCard>
              );
            }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { paddingVertical: 4 },
  backText: { fontSize: 17, color: colors.accent, fontWeight: '500' },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  inviteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  inviteBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  list: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: BOTTOM_TAB_PADDING,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitial: { fontSize: 15, fontWeight: '700', color: colors.accent },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontWeight: '500', color: colors.text },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
    backgroundColor: colors.surface,
  },
  roleBadgeAdmin: { backgroundColor: colors.accentSoft },
  roleText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  roleTextAdmin: { color: colors.accent },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnDanger: { borderColor: colors.error + '60' },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  actionBtnTextDanger: { color: colors.error },
});
