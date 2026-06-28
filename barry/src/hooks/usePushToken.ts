import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

/**
 * Registers the device for push notifications and upserts the token into
 * push_tokens. Returns true on success, false if permission was denied or
 * the EAS project ID is unavailable (bare dev).
 */
export async function registerPushToken(userId: string): Promise<boolean> {
  const projectId = getProjectId();
  if (!projectId) return false;

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
  if (finalStatus !== 'granted') return false;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (!token) return false;

  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  await supabase.from('push_tokens').upsert(
    { user_id: userId, token, platform, updated_at: new Date().toISOString() },
    { onConflict: 'token' },
  );
  return true;
}

/**
 * Removes the current device's push token from the DB on sign-out.
 * Call this before supabase.auth.signOut().
 */
export async function deregisterPushToken(): Promise<void> {
  const projectId = getProjectId();
  if (!projectId) return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (!data) return;

  await supabase.from('push_tokens').delete().eq('token', data);
}

/**
 * Registers the device for push notifications after sign-in. Must be called
 * inside an authenticated context.
 */
export function usePushTokenRegistration(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    registerPushToken(userId).then((registered) => {
      // cancelled flag prevents state updates after unmount
      if (!registered && !cancelled) {
        // Permission not granted or no project ID — silent no-op
      }
    });

    return () => { cancelled = true; };
  }, [userId]);
}
