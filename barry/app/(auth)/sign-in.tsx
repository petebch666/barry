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
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/lib/supabase';
import { EmailAuthSchema } from '@/schemas';

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
      Alert.alert('Validation error', parsed.error.errors[0].message);
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

  function toggleMode() {
    setMode(m => (m === 'signin' ? 'signup' : 'signin'));
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Sign in to Barry</Text>
        <Text style={styles.subtitle}>Choose how you'd like to continue</Text>

        <View style={styles.buttons}>
          <OAuthButton
            label="Continue with Google"
            icon="G"
            onPress={() => signInWith('google')}
            loading={loading === 'google'}
            disabled={loading !== null}
          />
          <OAuthButton
            label="Continue with Apple"
            icon=""
            onPress={() => signInWith('apple')}
            loading={loading === 'apple'}
            disabled={loading !== null}
            dark
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.emailForm}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#94A3B8"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={loading === null}
          />
          <TextInput
            style={styles.input}
            placeholder="Password (min. 8 characters)"
            placeholderTextColor="#94A3B8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={loading === null}
          />
          <TouchableOpacity
            style={styles.emailButton}
            onPress={submitEmail}
            disabled={loading !== null}
            accessibilityRole="button"
          >
            {loading === 'email' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.emailButtonLabel}>
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleMode} accessibilityRole="button">
            <Text style={styles.toggleText}>
              {mode === 'signin'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.legal}>
          By continuing you agree to our Terms of Service and Privacy Policy.
          Your friends' location data is never shared outside this app.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface OAuthButtonProps {
  label: string;
  icon: string;
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
  dark?: boolean;
}

function OAuthButton({ label, icon, onPress, loading, disabled, dark }: OAuthButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.oauthButton, dark && styles.oauthButtonDark]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      {loading ? (
        <ActivityIndicator color={dark ? '#FFFFFF' : '#1E293B'} />
      ) : (
        <>
          <Text style={[styles.oauthIcon, dark && styles.oauthIconDark]}>{icon}</Text>
          <Text style={[styles.oauthLabel, dark && styles.oauthLabelDark]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    padding: 32,
    paddingTop: 80,
    paddingBottom: 48,
    flexGrow: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 48,
  },
  buttons: {
    gap: 12,
  },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 56,
  },
  oauthButtonDark: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  oauthIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  oauthIconDark: {
    color: '#FFFFFF',
  },
  oauthLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  oauthLabelDark: {
    color: '#FFFFFF',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 28,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  emailForm: {
    gap: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#1E293B',
    minHeight: 56,
  },
  emailButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 14,
    paddingVertical: 16,
    minHeight: 56,
    marginTop: 4,
  },
  emailButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  toggleText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '500',
    marginTop: 4,
  },
  legal: {
    marginTop: 40,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
});
