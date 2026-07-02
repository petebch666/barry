import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { supabase } from '@/lib/supabase';
import { useProfile, useUpdateProfile, useSavedPlaces } from '@/hooks/useProfile';
import { useGroups, useJoinGroup } from '@/hooks/useGroups';
import { deregisterPushToken } from '@/hooks/usePushToken';
import { GlassCard } from '@/components/GlassCard';
import { GlassButton } from '@/components/GlassButton';
import { colors, radii, BOTTOM_TAB_PADDING } from '@/lib/theme';
import type { Group } from '@/schemas';

export default function ProfileScreen() {
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: groups = [], isLoading: groupsLoading } = useGroups();
  const { data: savedPlaces = [], isLoading: placesLoading } = useSavedPlaces();
  const { mutateAsync: joinGroup, isPending: isJoining } = useJoinGroup();
  const { mutateAsync: updateProfile, isPending: isSavingName } = useUpdateProfile();

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const initials = profile?.display_name
    ? profile.display_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  function startEditName() {
    setNameInput(profile?.display_name ?? '');
    setEditingName(true);
  }

  async function submitName() {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === profile?.display_name) {
      setEditingName(false);
      return;
    }
    try {
      await updateProfile({ display_name: trimmed });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not update name.');
    } finally {
      setEditingName(false);
    }
  }

  async function performSignOut() {
    try { await deregisterPushToken(); } catch {}
    await supabase.removeAllChannels();
    await supabase.auth.signOut();
  }

  async function signOut() {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) {
        await performSignOut();
      }
      return;
    }
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: performSignOut },
    ]);
  }

  async function handleJoin() {
    const code = inviteCode.trim().toUpperCase();
    if (code.length !== 8) {
      Alert.alert('Invalid code', 'Invite codes are 8 characters long.');
      return;
    }
    try {
      const group = await joinGroup(code);
      setShowJoinModal(false);
      setInviteCode('');
      router.push(`/(app)/(groups)/${group.id}` as never);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Invalid invite code.');
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* ── Profile header ── */}
          <GlassCard style={styles.profileCard}>
            <View style={styles.avatarRow}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
              <View style={styles.nameBlock}>
                {profileLoading ? (
                  <ActivityIndicator color={colors.accent} />
                ) : editingName ? (
                  <TextInput
                    style={styles.nameInput}
                    value={nameInput}
                    onChangeText={setNameInput}
                    onBlur={submitName}
                    onSubmitEditing={submitName}
                    autoFocus
                    maxLength={60}
                    returnKeyType="done"
                    accessibilityLabel="Display name"
                  />
                ) : (
                  <TouchableOpacity
                    onPress={startEditName}
                    accessibilityRole="button"
                    accessibilityLabel="Edit display name"
                  >
                    <Text style={styles.displayName}>{profile?.display_name ?? '—'}</Text>
                    <Text style={styles.editHint}>
                      {isSavingName ? 'Saving…' : 'Tap to edit'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </GlassCard>

          {/* ── Groups section ── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Groups</Text>
            <View style={styles.sectionActions}>
              <TouchableOpacity
                onPress={() => setShowJoinModal(true)}
                style={styles.sectionBtn}
                accessibilityRole="button"
                accessibilityLabel="Join a group"
              >
                <Text style={styles.sectionBtnText}>Join</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/create-group')}
                style={[styles.sectionBtn, styles.sectionBtnPrimary]}
                accessibilityRole="button"
                accessibilityLabel="Create a group"
              >
                <Text style={[styles.sectionBtnText, styles.sectionBtnTextPrimary]}>+ New</Text>
              </TouchableOpacity>
            </View>
          </View>

          {groupsLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
          ) : groups.length === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <Text style={styles.emptyText}>No groups yet</Text>
              <Text style={styles.emptyHint}>
                Create one or ask a friend for an invite link.
              </Text>
            </GlassCard>
          ) : (
            <View style={styles.groupsList}>
              {groups.map((group) => (
                <GroupRow key={group.id} group={group} />
              ))}
            </View>
          )}

          {/* ── Saved Places section ── */}
          <View style={[styles.sectionHeader, { marginTop: 8 }]}>
            <Text style={styles.sectionTitle}>Saved Places</Text>
          </View>

          {placesLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/(app)/(places)' as never)}
              accessibilityRole="button"
              accessibilityLabel="See all places"
              activeOpacity={0.75}
            >
              <GlassCard style={styles.placesSummaryCard}>
                <Text style={styles.placesSummaryText}>
                  {savedPlaces.length === 0
                    ? 'No places saved yet'
                    : `You have saved ${savedPlaces.length} place${savedPlaces.length === 1 ? '' : 's'}`}
                </Text>
                <Text style={styles.chevron}>›</Text>
              </GlassCard>
            </TouchableOpacity>
          )}

          {/* ── Settings / Sign out ── */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => router.push('/(app)/(profile)/settings')}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Text style={styles.menuRowText}>Settings</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <GlassButton
              label="Sign out"
              variant="danger"
              onPress={signOut}
              style={styles.signOutBtn}
            />
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Join with code modal */}
      <Modal
        visible={showJoinModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView tint="dark" intensity={60} style={styles.absoluteFillNoEvents} pointerEvents="none" />
          <View style={styles.modalBox}>
            <BlurView tint="dark" intensity={50} style={styles.absoluteFillNoEvents} pointerEvents="none" />
            <View style={styles.modalBg} />
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Join with invite code</Text>
              <TextInput
                style={styles.codeInput}
                placeholder="Enter 8-character code"
                placeholderTextColor={colors.textTertiary}
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="characters"
                maxLength={8}
                autoFocus
              />
              <GlassButton
                label="Join group"
                loading={isJoining}
                onPress={handleJoin}
                style={{ marginTop: 4 }}
              />
              <TouchableOpacity
                onPress={() => { setShowJoinModal(false); setInviteCode(''); }}
                accessibilityRole="button"
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function GroupRow({ group }: { group: Group }) {
  const router = useRouter();
  const initial = group.name[0]?.toUpperCase() ?? '?';
  return (
    <TouchableOpacity
      onPress={() => router.push(`/(app)/(groups)/${group.id}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`Open group: ${group.name}`}
      activeOpacity={0.75}
    >
      <GlassCard style={styles.groupRow}>
        <View style={styles.groupAvatar}>
          <Text style={styles.groupAvatarText}>{initial}</Text>
        </View>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{group.name}</Text>
          {group.description ? (
            <Text style={styles.groupDesc} numberOfLines={1}>{group.description}</Text>
          ) : null}
        </View>
        <Text style={styles.chevron}>›</Text>
      </GlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: BOTTOM_TAB_PADDING,
    gap: 12,
  },

  profileCard: { padding: 20 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { color: colors.text, fontSize: 20, fontWeight: '700' },
  nameBlock: { flex: 1 },
  displayName: { fontSize: 20, fontWeight: '700', color: colors.text },
  editHint: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  nameInput: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
    paddingVertical: 2,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  sectionActions: { flexDirection: 'row', gap: 8 },
  sectionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionBtnPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  sectionBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  sectionBtnTextPrimary: { color: colors.text },

  groupsList: { gap: 8 },
  groupRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  groupAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatarText: { fontSize: 16, fontWeight: '700', color: colors.accent },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 16, fontWeight: '600', color: colors.text },
  groupDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.textTertiary },

  placesSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  placesSummaryText: { fontSize: 15, fontWeight: '600', color: colors.text },

  emptyCard: { padding: 24, alignItems: 'center', gap: 6 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  emptyHint: { fontSize: 14, color: colors.textTertiary, textAlign: 'center' },

  footer: { gap: 12, marginTop: 4 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
  },
  menuRowText: { fontSize: 16, fontWeight: '500', color: colors.text },
  signOutBtn: { width: '100%' },

  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalBox: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    gap: 14,
  },
  absoluteFillNoEvents: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  modalBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(18,14,28,0.7)',
    pointerEvents: 'none',
  },
  modalContent: { position: 'relative', gap: 14 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  codeInput: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 16,
    fontSize: 20,
    color: colors.text,
    letterSpacing: 4,
    textAlign: 'center',
    fontWeight: '700',
  },
  cancelText: {
    textAlign: 'center',
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
