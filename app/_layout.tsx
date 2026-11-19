import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Stack, useRouter, useSegments, type ErrorBoundaryProps } from 'expo-router';
import { colors, BARRY_HEADER_HEIGHT } from '@/lib/theme';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { usePushTokenRegistration } from '@/hooks/usePushToken';
import type { Session } from '@supabase/supabase-js';
import { reportError } from '@/lib/reportError';
import { ErrorScreen } from '@/components/ErrorScreen';

// Show notifications as banners while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => reportError(error, { queryKey: query.queryKey }),
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) =>
      reportError(error, { mutationKey: mutation.options.mutationKey }),
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

// Expo Router renders this instead of the app when anything below throws.
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <ErrorScreen {...props} />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
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
  const inAuthGroup = segments[0] === '(auth)';
  // The reset link signs the user in before they choose the new password, so
  // that screen must not bounce them into the app.
  const onResetScreen = inAuthGroup && (segments as string[])[1] === 'reset-password';

  // Register push token whenever we have a signed-in user
  usePushTokenRegistration(session?.user?.id ?? null);

  // ── Auth state ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      // getSession() only reads the locally persisted session. For a
      // signed-in user, also validate it against the Auth server via
      // getUser() before flipping `initialized` — this guarantees the
      // client's session is fully attached to outgoing requests, avoiding a
      // race where RLS-scoped queries fire too early and silently return
      // zero rows.
      if (s) await supabase.auth.getUser();
      if (cancelled) return;
      setSession(s);
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // ── Route guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!initialized || redirecting.current) return;

    if (!session && !inAuthGroup) {
      redirecting.current = true;
      router.replace('/(auth)');
      redirecting.current = false;
    } else if (session && inAuthGroup && !onResetScreen) {
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
    <>
      {!inAuthGroup && (
        <View style={styles.barryHeader}>
          <Text style={styles.barryText}>barry</Text>
        </View>
      )}
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="create-group" options={{ presentation: 'modal' }} />
      <Stack.Screen name="create-ping" options={{ presentation: 'modal' }} />
      <Stack.Screen name="rsvp/[pingId]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="suggest-place/[pingId]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="add-saved-place" options={{ presentation: 'modal' }} />
      <Stack.Screen name="join/[code]" />
      <Stack.Screen name="invite/[groupId]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="feedback" options={{ presentation: 'modal' }} />
      <Stack.Screen name="change-password" options={{ presentation: 'modal' }} />
    </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  barryHeader: {
    height: BARRY_HEADER_HEIGHT,
    paddingTop: Platform.select({ ios: 52, android: 28, default: 0 }),
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barryText: {
    fontFamily: Platform.OS === 'web' ? '"Comic Sans MS", cursive' : 'Comic Sans MS',
    fontSize: 42,
    fontWeight: 'bold',
    color: colors.accent,
    lineHeight: 46,
  },
});
