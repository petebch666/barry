import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

/**
 * Registers the device for push notifications after sign-in and upserts the
 * Expo push token into push_tokens. Must be called inside an authenticated context.
 *
 * Security: the token is stored server-side and only dispatched by Edge Functions
 * via the service role key — the client never sends pushes directly.
 */
export function usePushTokenRegistration(userId: string | null) {
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function register() {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

      if (!projectId) {
        // EAS project ID is required for Expo Push API — skip silently in bare dev
        return;
      }

      // Android requires an explicit notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6366F1',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return;

      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
      if (!token || cancelled) return;

      const platform = Platform.OS === 'ios' ? 'ios' : 'android';

      // Upsert: one row per device token; update platform on conflict
      await supabase.from('push_tokens').upsert(
        { user_id: userId, token, platform, updated_at: new Date().toISOString() },
        { onConflict: 'token' },
      );
    }

    register();
    return () => { cancelled = true; };
  }, [userId]);
}

/**
 * Removes the current device's push token from the DB on sign-out.
 * Call this before supabase.auth.signOut().
 */
export async function deregisterPushToken() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) return;

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (!data) return;

  await supabase.from('push_tokens').delete().eq('token', data);
}
