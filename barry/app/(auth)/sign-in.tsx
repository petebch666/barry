import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);

  async function signInWith(provider: 'google' | 'apple') {
    setLoading(provider);
    try {
      const redirectTo = makeRedirectUri({ scheme: 'barry', path: 'auth/callback' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
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
      const message = err instanceof Error ? err.message : 'Authentication failed';
      Alert.alert('Sign-in error', message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <View style={styles.container}>
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

      <Text style={styles.legal}>
        By continuing you agree to our Terms of Service and Privacy Policy.
        Your friends' location data is never shared outside this app.
      </Text>
    </View>
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
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 32,
    paddingTop: 80,
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
  legal: {
    marginTop: 40,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
});
