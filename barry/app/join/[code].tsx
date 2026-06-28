import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroupByInviteCode, useJoinGroup } from '@/hooks/useGroups';
import { GlassCard } from '@/components/GlassCard';
import { GlassButton } from '@/components/GlassButton';
import { colors } from '@/lib/theme';

export default function JoinGroupScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();

  const { data: group, isLoading } = useGroupByInviteCode(code ?? '');
  const { mutateAsync: joinGroup, isPending: isJoining } = useJoinGroup();

  useEffect(() => {
    if (!code) router.replace('/(app)/(feed)');
  }, [code, router]);

  useEffect(() => {
    if (!isLoading && !group && code) {
      Alert.alert('Invalid invite', 'This invite link is no longer valid.', [
        { text: 'OK', onPress: () => router.replace('/(app)/(feed)') },
      ]);
    }
  }, [isLoading, group, code, router]);

  async function handleJoin() {
    if (!group) return;
    try {
      await joinGroup(code ?? '');
      router.replace(`/(app)/(groups)/${group.id}` as never);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not join this group.');
    }
  }

  if (isLoading || !group) {
    return (
      <View style={styles.root}>
        <GlassButton label="" loading style={{ flex: 0 }} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Text style={styles.title}>You're invited!</Text>

          <GlassCard style={styles.card}>
            <View style={styles.groupAvatar}>
              <Text style={styles.groupAvatarText}>
                {group.name[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <Text style={styles.groupName}>{group.name}</Text>
            {group.description ? (
              <Text style={styles.groupDesc}>{group.description}</Text>
            ) : null}
          </GlassCard>

          <GlassButton
            label="Join group"
            loading={isJoining}
            onPress={handleJoin}
            accessibilityLabel={`Join ${group.name}`}
          />

          <TouchableOpacity
            onPress={() => router.replace('/(app)/(feed)')}
            accessibilityRole="button"
            accessibilityLabel="Decline invite"
          >
            <Text style={styles.declineText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, width: '100%' },
  content: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 20 },
  title: { fontSize: 34, fontWeight: '700', color: colors.text, textAlign: 'center' },
  card: { padding: 28, alignItems: 'center', gap: 10 },
  groupAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatarText: { fontSize: 26, fontWeight: '700', color: colors.accent },
  groupName: { fontSize: 22, fontWeight: '700', color: colors.text },
  groupDesc: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
  declineText: {
    color: colors.textTertiary,
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '500',
  },
});
