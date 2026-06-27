import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { usePushTokenRegistration } from '@/hooks/usePushToken';
import type { Session } from '@supabase/supabase-js';

// Show notifications as banners while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="auto" />
        <AuthGate />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

/**
 * Listens to Supabase auth state and redirects between the auth and app stacks.
 * Also registers the device for push notifications and handles deep-link taps
 * from notification banners.
 */
function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const redirecting = useRef(false);

  // Register push token whenever we have a signed-in user
  usePushTokenRegistration(session?.user?.id ?? null);

  // ── Auth state ──────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Route guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!initialized || redirecting.current) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      redirecting.current = true;
      router.replace('/(auth)');
      redirecting.current = false;
    } else if (session && inAuthGroup) {
      redirecting.current = true;
      router.replace('/(app)/(feed)');
      redirecting.current = false;
    }
  }, [session, initialized, segments, router]);

  // ── Notification deep-link (tap on banner while app is backgrounded/killed) ─
  useEffect(() => {
    // Fired when user taps a notification that opened the app from background/killed
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        pingId?: string;
        type?: string;
      };
      if (data?.pingId) {
        router.push(`/(app)/(feed)/ping/${data.pingId}`);
      }
    });

    return () => subscription.remove();
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="create-group" options={{ presentation: 'modal' }} />
      <Stack.Screen name="create-ping" options={{ presentation: 'modal' }} />
      <Stack.Screen name="rsvp/[pingId]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="suggest-place/[pingId]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="join/[code]" />
    </Stack>
  );
}
