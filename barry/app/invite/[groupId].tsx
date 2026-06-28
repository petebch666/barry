import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroup, useInviteLink } from '@/hooks/useGroups';

export default function InviteModal() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { data: group } = useGroup(groupId);
  const { data: inviteLink, isLoading } = useInviteLink(groupId);

  async function copyLink() {
    if (!inviteLink) return;
    await Clipboard.setStringAsync(inviteLink);
    Alert.alert('Copied', 'Invite link copied to clipboard.');
  }

  async function shareLink() {
    if (!inviteLink) return;
    try {
      await Share.share({
        message: `Join my group "${group?.name ?? ''}" on Barry: ${inviteLink}`,
        url: inviteLink,
      });
    } catch {
      Alert.alert('Could not share', 'Please try again.');
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ width: 56 }} />
        <Text style={styles.title}>Invite people</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Group identity */}
        {group && (
          <View style={styles.groupInfo}>
            <View style={styles.groupAvatar}>
              <Text style={styles.groupAvatarText}>{group.name[0].toUpperCase()}</Text>
            </View>
            <Text style={styles.groupName}>{group.name}</Text>
          </View>
        )}

        <Text style={styles.label}>Share this link</Text>

        {/* Link display */}
        <View style={styles.linkBox}>
          {isLoading ? (
            <ActivityIndicator color="#6366F1" />
          ) : (
            <Text style={styles.linkText} numberOfLines={1} selectable>
              {inviteLink ?? '—'}
            </Text>
          )}
        </View>

        <Text style={styles.hint}>
          Anyone with this link can join the group. The code doesn't expire.
        </Text>

        {/* Actions */}
        <TouchableOpacity
          style={styles.copyButton}
          onPress={copyLink}
          disabled={!inviteLink || isLoading}
          accessibilityRole="button"
          accessibilityLabel="Copy invite link"
        >
          <Text style={styles.copyButtonText}>Copy link</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.shareButton, (!inviteLink || isLoading) && styles.buttonDisabled]}
          onPress={shareLink}
          disabled={!inviteLink || isLoading}
          accessibilityRole="button"
          accessibilityLabel="Share invite link"
        >
          <Text style={styles.shareButtonText}>Share…</Text>
        </TouchableOpacity>
      </View>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: { fontSize: 17, fontWeight: '600', color: '#1E293B' },
  doneText: { fontSize: 16, color: '#6366F1', fontWeight: '600', width: 56, textAlign: 'right' },

  content: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },

  groupInfo: { alignItems: 'center', marginBottom: 32 },
  groupAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  groupAvatarText: { fontSize: 26, fontWeight: '700', color: '#6366F1' },
  groupName: { fontSize: 18, fontWeight: '600', color: '#1E293B' },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },

  linkBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    minHeight: 48,
    justifyContent: 'center',
  },
  linkText: { fontSize: 14, color: '#6366F1', fontFamily: 'monospace', fontWeight: '500' },

  hint: { fontSize: 13, color: '#94A3B8', lineHeight: 18, marginBottom: 28 },

  copyButton: {
    backgroundColor: '#6366F1',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  copyButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  shareButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#6366F1',
  },
  shareButtonText: { color: '#6366F1', fontSize: 16, fontWeight: '600' },

  buttonDisabled: { opacity: 0.5 },
});
