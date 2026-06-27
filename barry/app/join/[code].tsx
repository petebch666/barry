import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import type { Group } from '@/schemas';

export default function JoinGroupScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!code) return;
    supabase
      .from('groups')
      .select('*')
      .eq('invite_code', code)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          Alert.alert('Invalid invite', 'This invite link is no longer valid.', [
            { text: 'OK', onPress: () => router.replace('/(app)/(feed)') },
          ]);
        } else {
          setGroup(data as Group);
        }
        setLoading(false);
      });
  }, [code, router]);

  async function joinGroup() {
    if (!group) return;
    setJoining(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: user.id, role: 'member' });

    setJoining(false);

    if (error?.code === '23505') {
      // Already a member — just navigate
      router.replace(`/(app)/(groups)/${group.id}`);
      return;
    }
    if (error) {
      Alert.alert('Error', 'Could not join this group. Please try again.');
      return;
    }
    router.replace(`/(app)/(groups)/${group.id}`);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ActivityIndicator style={{ flex: 1 }} color="#3B82F6" />
      </SafeAreaView>
    );
  }

  if (!group) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.title}>You're invited!</Text>
        <View style={styles.card}>
          <Text style={styles.groupName}>{group.name}</Text>
          {group.description ? (
            <Text style={styles.description}>{group.description}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.joinButton}
          onPress={joinGroup}
          disabled={joining}
          accessibilityRole="button"
          accessibilityLabel={`Join ${group.name}`}
        >
          {joining ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.joinButtonText}>Join group</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.replace('/(app)/(feed)')}
          accessibilityRole="button"
          accessibilityLabel="Decline invite"
        >
          <Text style={styles.declineText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { flex: 1, padding: 32, justifyContent: 'center', gap: 24 },
  title: { fontSize: 32, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 8,
  },
  groupName: { fontSize: 22, fontWeight: '700', color: '#1E293B' },
  description: { fontSize: 15, color: '#64748B', textAlign: 'center' },
  joinButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    minHeight: 56,
  },
  joinButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  declineText: { color: '#94A3B8', fontSize: 15, textAlign: 'center', fontWeight: '500' },
});
