import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/lib/supabase';
import { EmailAuthSchema } from '@/schemas';
import { colors, radii } from '@/lib/theme';

WebBrowser.maybeCompleteAuthSession();

type LoadingState = 'google' | 'apple' | 'email' | null;
type Mode = 'signin' | 'signup';

export default function SignInScreen() {
  const [loading, setLoading] = useState<LoadingState>(null);
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function signInWith(provider: 'google' | 'apple') {
    setLoading(provider);
    try {
      const redirectTo = makeRedirectUri({ scheme: 'barry', path: 'auth/callback' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });

      if (error) throw error;
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
      Alert.alert('Sign-in error', err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(null);
    }
  }

  async function submitEmail() {
    const parsed = EmailAuthSchema.safeParse({ email, password });
    if (!parsed.success) {
      Alert.alert('Validation error', parsed.error.issues[0]?.message ?? 'Validation failed');
      return;
    }

    setLoading('email');
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp(parsed.data);
        if (error) throw error;
        Alert.alert('Check your email', 'We sent you a confirmation link. Click it to activate your account.');
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Authentication failed');
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
            <BlurView tint="dark" intensity={50} style={StyleSheet.absoluteFill} />
            <View style={styles.cardOverlay} />

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={loading === null}
              returnKeyType="next"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={loading === null}
              returnKeyType="done"
              onSubmitEditing={submitEmail}
            />

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

            <TouchableOpacity
              onPress={() => setMode(m => m === 'signin' ? 'signup' : 'signin')}
              accessibilityRole="button"
            >
              <Text style={styles.toggleText}>
                {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <OAuthButton
            label="Continue with Google"
            prefix="G"
            onPress={() => signInWith('google')}
            loading={loading === 'google'}
            disabled={loading !== null}
          />
          <OAuthButton
            label="Continue with Apple"
            prefix=""
            onPress={() => signInWith('apple')}
            loading={loading === 'apple'}
            disabled={loading !== null}
          />
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
      <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />
      <View style={styles.oauthBtnOverlay} />
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          <Text style={styles.oauthPrefix}>{prefix}</Text>
          <Text style={styles.oauthLabel}>{label}</Text>
        </>
      )}
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
    borderColor: colors.border,
    padding: 20,
    gap: 12,
  },
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
  },
  input: {
    height: 50,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
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
  },
  oauthPrefix: { fontSize: 16, fontWeight: '700', color: colors.text },
  oauthLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
});
