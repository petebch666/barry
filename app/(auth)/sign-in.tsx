import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { BlurView } from 'expo-blur';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import { authRedirect } from '@/lib/authRedirect';
import { INVITE_ONLY } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import { EmailAuthSchema } from '@/schemas';
import { colors, radii } from '@/lib/theme';

WebBrowser.maybeCompleteAuthSession();

type LoadingState = 'apple' | 'email' | null;
type Mode = 'signin' | 'signup';

export default function SignInScreen() {
  const [loading, setLoading] = useState<LoadingState>(null);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  function clearError() {
    if (error) setError(null);
  }

  async function signInWith(provider: 'apple') {
    setLoading(provider);
    setError(null);
    try {
      const redirectTo = makeRedirectUri({ scheme: 'barry', path: 'auth/callback' });
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });

      if (oauthError) throw oauthError;
      if (!data.url) throw new Error('No OAuth URL returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
      }
    } catch (err) {
      showAlert('Sign-in error', err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(null);
    }
  }

  async function submitEmail() {
    setError(null);
    const parsed = EmailAuthSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Validation failed');
      return;
    }

    setLoading('email');
    try {
      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword(parsed.data);
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          ...parsed.data,
          options: { emailRedirectTo: authRedirect('auth/callback') },
        });
        if (signUpError) throw signUpError;
        showAlert(
          'Check your email',
          'We sent you a confirmation link. Click it to activate your account.',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(null);
    }
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.wordmark}>barry</Text>
            <Text style={styles.tagline}>plan the night, find the spot</Text>
          </View>

          <View style={styles.card}>
            <BlurView
              tint="dark"
              intensity={50}
              style={styles.absoluteFillNoEvents}
            />
            <View style={styles.cardOverlay} />

            {/*
              Content must be in a positioned (position:relative) wrapper so it
              paints above the absolute overlays in CSS stacking order. Without
              this, static HTML inputs are painted before position:absolute
              elements and end up visually hidden behind the BlurView/overlay.
            */}
            <View style={styles.cardContent}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={t => { setEmail(t); clearError(); }}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={loading === null}
                returnKeyType="next"
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={t => { setPassword(t); clearError(); }}
                secureTextEntry
                editable={loading === null}
                returnKeyType="done"
                onSubmitEditing={submitEmail}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryBtn, loading !== null && styles.btnDisabled]}
                onPress={submitEmail}
                disabled={loading !== null}
                accessibilityRole="button"
                accessibilityLabel={mode === 'signin' ? 'Sign in' : 'Create account'}
              >
                {loading === 'email' ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {mode === 'signin' ? 'Sign in' : 'Create account'}
                  </Text>
                )}
              </TouchableOpacity>

              {INVITE_ONLY ? (
                <Text style={styles.inviteHint}>
                  Barry is in private beta. Forgot your password, or need an account? Ask the person who invited you.
                </Text>
              ) : (
                <>
                  {mode === 'signin' && (
                    <TouchableOpacity
                      onPress={() => router.push({ pathname: '/(auth)/forgot-password', params: { email } })}
                      accessibilityRole="button"
                    >
                      <Text style={styles.toggleText}>Forgot password?</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(null); }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.toggleText}>
                      {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {!INVITE_ONLY && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <OAuthButton
                label="Continue with Apple"
                prefix=""
                onPress={() => signInWith('apple')}
                loading={loading === 'apple'}
                disabled={loading !== null}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function OAuthButton({
  label, prefix, onPress, loading, disabled,
}: {
  label: string; prefix: string; onPress: () => void; loading: boolean; disabled: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.oauthBtn, disabled && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <BlurView
        tint="dark"
        intensity={40}
        style={styles.absoluteFillNoEvents}
      />
      <View style={styles.oauthBtnOverlay} />
      <View style={styles.oauthContent}>
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <Text style={styles.oauthPrefix}>{prefix}</Text>
            <Text style={styles.oauthLabel}>{label}</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 64,
    gap: 16,
  },
  header: { alignItems: 'center', marginBottom: 8 },
  wordmark: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -2,
  },
  tagline: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  card: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    padding: 20,
    gap: 12,
  },
  absoluteFillNoEvents: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    pointerEvents: 'none',
  },
  // position:relative makes this a positioned element, which paints AFTER the
  // absolute overlays (BlurView, cardOverlay) in the CSS stacking order.
  cardContent: {
    position: 'relative',
    gap: 12,
  },
  input: {
    height: 50,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
  },
  primaryBtn: {
    height: 50,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.45 },
  inviteHint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  toggleText: {
    textAlign: 'center',
    fontSize: 14,
    color: colors.accent,
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 13, color: colors.textTertiary, fontWeight: '500' },
  oauthBtn: {
    height: 50,
    borderRadius: radii.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  oauthBtnOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    pointerEvents: 'none',
  },
  oauthContent: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  oauthPrefix: { fontSize: 16, fontWeight: '700', color: colors.text },
  oauthLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
});
