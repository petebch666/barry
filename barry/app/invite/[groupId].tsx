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
import { GlassCard } from '@/components/GlassCard';
import { GlassButton } from '@/components/GlassButton';
import { colors } from '@/lib/theme';

export default function InviteModal() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { data: group } = useGroup(groupId);
  const { data: inviteLink, isLoading } = useInviteLink(groupId);

  const inviteCode = inviteLink?.split('/').pop() ?? '—';

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
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.navBar}>
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
          {group && (
            <View style={styles.groupInfo}>
              <View style={styles.groupAvatar}>
                <Text style={styles.groupAvatarText}>{group.name[0].toUpperCase()}</Text>
              </View>
              <Text style={styles.groupName}>{group.name}</Text>
            </View>
          )}

          <GlassCard style={styles.codeBox}>
            {isLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <Text style={styles.codeLabel}>Invite code</Text>
                <Text style={styles.code} selectable>{inviteCode}</Text>
                <Text style={styles.linkPreview} numberOfLines={1}>{inviteLink ?? '—'}</Text>
              </>
            )}
          </GlassCard>

          <Text style={styles.hint}>
            Anyone with this link can join the group. The code doesn't expire.
          </Text>

          <GlassButton
            label="Copy link"
            onPress={copyLink}
            disabled={!inviteLink || isLoading}
          />
          <GlassButton
            label="Share…"
            variant="ghost"
            onPress={shareLink}
            disabled={!inviteLink || isLoading}
          />
        </View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  doneText: { fontSize: 16, color: colors.accent, fontWeight: '600', width: 56, textAlign: 'right' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16, gap: 16 },
  groupInfo: { alignItems: 'center', paddingBottom: 8 },
  groupAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  groupAvatarText: { fontSize: 24, fontWeight: '700', color: colors.accent },
  groupName: { fontSize: 18, fontWeight: '600', color: colors.text },
  codeBox: { padding: 20, alignItems: 'center', gap: 6 },
  codeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  code: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 6,
    fontFamily: 'monospace',
  },
  linkPreview: {
    fontSize: 12,
    color: colors.textTertiary,
    fontFamily: 'monospace',
  },
  hint: { fontSize: 13, color: colors.textTertiary, lineHeight: 18, textAlign: 'center' },
});
