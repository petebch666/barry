import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  Linking,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { registerPushToken, deregisterPushToken } from '@/hooks/usePushToken';
import { useProfile } from '@/hooks/useProfile';

export default function SettingsScreen() {
  const router = useRouter();
  const { data: profile } = useProfile();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setNotificationsEnabled(status === 'granted');
    });
  }, []);

  async function toggleNotifications(value: boolean) {
    setNotifLoading(true);
    try {
      if (!value) {
        await deregisterPushToken();
        setNotificationsEnabled(false);
      } else {
        if (!profile?.id) return;
        const success = await registerPushToken(profile.id);
        if (success) {
          setNotificationsEnabled(true);
        } else {
          // OS permission is denied — we can't enable it programmatically
          Alert.alert(
            'Notifications blocked',
            'Barry doesn\'t have notification permission. Enable it in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open settings', onPress: () => Linking.openSettings() },
            ],
          );
        }
      }
    } finally {
      setNotifLoading(false);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This permanently deletes your profile, groups, pings, saved places, and location data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete my account', style: 'destructive', onPress: deleteAccount },
      ],
    );
  }

  async function deleteAccount() {
    try {
      await deregisterPushToken();
      await supabase.removeAllChannels();
      const { error } = await supabase.rpc('delete_user');
      if (error) throw error;
      await supabase.auth.signOut();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not delete account. Please try again.');
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Notifications */}
        <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Push notifications</Text>
              <Text style={styles.settingSubLabel}>
                Pings, voting starts, and meetup confirmations
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              disabled={notifLoading}
              trackColor={{ true: '#6366F1' }}
              accessibilityLabel="Toggle push notifications"
            />
          </View>
        </View>

        {/* Account */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>ACCOUNT</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.destructiveRow}
            onPress={confirmDeleteAccount}
            accessibilityRole="button"
            accessibilityLabel="Delete my account"
          >
            <Text style={styles.destructiveLabel}>Delete my account</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.destructiveHint}>
          Permanently removes your profile, groups, pings, and location data. This action cannot be reversed.
        </Text>
      </ScrollView>
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

  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  settingText: { flex: 1 },
  settingLabel: { fontSize: 15, fontWeight: '500', color: '#1E293B' },
  settingSubLabel: { fontSize: 13, color: '#64748B', marginTop: 2, lineHeight: 18 },

  destructiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  destructiveLabel: { fontSize: 15, fontWeight: '500', color: '#EF4444' },
  chevron: { fontSize: 20, color: '#CBD5E1' },

  destructiveHint: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 4,
  },
});
