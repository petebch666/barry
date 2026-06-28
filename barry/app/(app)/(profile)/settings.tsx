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
import { GlassCard } from '@/components/GlassCard';
import { colors, BOTTOM_TAB_PADDING } from '@/lib/theme';

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
          Alert.alert(
            'Notifications blocked',
            "Barry doesn't have notification permission. Enable it in your device settings.",
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
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
          <GlassCard style={styles.card}>
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
                trackColor={{ true: colors.accent }}
                accessibilityLabel="Toggle push notifications"
              />
            </View>
          </GlassCard>

          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>ACCOUNT</Text>
          <GlassCard style={styles.card}>
            <TouchableOpacity
              style={styles.destructiveRow}
              onPress={confirmDeleteAccount}
              accessibilityRole="button"
              accessibilityLabel="Delete my account"
            >
              <Text style={styles.destructiveLabel}>Delete my account</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </GlassCard>
          <Text style={styles.destructiveHint}>
            Permanently removes your profile, groups, pings, and location data. This action cannot be reversed.
          </Text>
        </ScrollView>
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
    paddingVertical: 14,
  },
  backBtn: { paddingVertical: 4 },
  backText: { fontSize: 17, color: colors.accent, fontWeight: '500' },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: BOTTOM_TAB_PADDING,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  card: { overflow: 'hidden' },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  settingText: { flex: 1 },
  settingLabel: { fontSize: 15, fontWeight: '500', color: colors.text },
  settingSubLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  destructiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  destructiveLabel: { fontSize: 15, fontWeight: '500', color: colors.error },
  chevron: { fontSize: 20, color: colors.textTertiary },
  destructiveHint: {
    fontSize: 12,
    color: colors.textTertiary,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
});
