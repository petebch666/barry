import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Linking,
  ScrollView,
  Platform,
  Share,
  ActivityIndicator,
} from 'react-native';
import { showAlert, confirmAction } from '@/lib/alert';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { registerPushToken, deregisterPushToken } from '@/hooks/usePushToken';
import { useProfile, useExportMyData, useDeleteAccount } from '@/hooks/useProfile';
import { exportFileName, formatExport } from '@/utils/exportFile';
import { GlassCard } from '@/components/GlassCard';
import { colors, BOTTOM_TAB_PADDING } from '@/lib/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const { mutateAsync: exportMyData, isPending: isExporting } = useExportMyData();
  const { mutateAsync: deleteMyAccount } = useDeleteAccount();

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
          const open = await confirmAction({
            title: 'Notifications blocked',
            message: "Barry doesn't have notification permission. Enable it in your device settings.",
            confirmText: 'Open settings',
          });
          if (open) Linking.openSettings();
        }
      }
    } finally {
      setNotifLoading(false);
    }
  }

  async function exportData() {
    try {
      const text = formatExport(await exportMyData());
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = exportFileName(new Date());
        link.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ title: exportFileName(new Date()), message: text });
      }
    } catch (err) {
      showAlert('Error', err instanceof Error ? err.message : 'Could not export your data.');
    }
  }

  async function confirmDeleteAccount() {
    const ok = await confirmAction({
      title: 'Delete account',
      message: 'This permanently deletes your account, saved places, RSVPs and location data. Groups and pings you created stay for the other members, without your name. This cannot be undone.',
      confirmText: 'Delete my account',
      destructive: true,
    });
    if (ok) deleteAccount();
  }

  async function deleteAccount() {
    try {
      await deleteMyAccount();
    } catch (err) {
      showAlert('Error', err instanceof Error ? err.message : 'Could not delete account. Please try again.');
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

          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>BETA</Text>
          <GlassCard style={styles.card}>
            <TouchableOpacity
              style={styles.destructiveRow}
              onPress={() => router.push('/feedback')}
              accessibilityRole="button"
              accessibilityLabel="Send feedback"
            >
              <Text style={styles.settingLabel}>Send feedback</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </GlassCard>
          <Text style={styles.destructiveHint}>
            A bug, something confusing, an idea: it goes straight to the developer.
          </Text>

          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>ACCOUNT</Text>
          <GlassCard style={styles.card}>
            <TouchableOpacity
              style={styles.destructiveRow}
              onPress={exportData}
              disabled={isExporting}
              accessibilityRole="button"
              accessibilityLabel="Export my data"
            >
              <Text style={styles.settingLabel}>Export my data</Text>
              {isExporting ? (
                <ActivityIndicator color={colors.textTertiary} />
              ) : (
                <Text style={styles.chevron}>›</Text>
              )}
            </TouchableOpacity>
          </GlassCard>
          <Text style={styles.destructiveHint}>
            A copy of everything Barry stores about you, as a JSON file.
          </Text>
          <GlassCard style={[styles.card, { marginTop: 16 }]}>
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
            Permanently removes your account and everything tied to it. Groups, pings and venues you created stay for the other members, without your name. This cannot be undone.
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
