import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useExchangeAuthCode, useSetNewPassword } from '@/hooks/useAuth';
import { showAlert } from '@/lib/alert';
import { EmailAuthSchema } from '@/schemas';
import { colors, radii } from '@/lib/theme';

// Opened from the reset email: barry://reset-password?code=… (or the web URL).
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const exchange = useExchangeAuthCode(code);
  const { mutateAsync: setNewPassword, isPending } = useSetNewPassword();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const parsed = EmailAuthSchema.shape.password.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid password');
      return;
    }
    try {
      await setNewPassword(parsed.data);
      showAlert('Password changed', "You're signed in with your new password.");
      router.replace('/(app)/(feed)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your password.');
    }
  }

  let content;
  if (!code || exchange.isError) {
    content = (
      <>
        <Text style={styles.body}>
          This link has expired or was opened on a different device. Request a new one from the device you'll use Barry on.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/forgot-password')} accessibilityRole="button">
          <Text style={styles.buttonText}>Send a new link</Text>
        </TouchableOpacity>
      </>
    );
  } else if (exchange.isPending) {
    content = <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />;
  } else {
    content = (
      <>
        <Text style={styles.body}>Choose a new password, at least 8 characters.</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="New password"
          placeholderTextColor={colors.textTertiary}
          secureTextEntry
          autoComplete="new-password"
          autoFocus
          onSubmitEditing={submit}
          accessibilityLabel="New password"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={styles.button}
          onPress={submit}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel="Save new password"
        >
          {isPending ? <ActivityIndicator color={colors.text} /> : <Text style={styles.buttonText}>Save password</Text>}
        </TouchableOpacity>
      </>
    );
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.container}>
          <Text style={styles.title}>New password</Text>
          {content}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, marginTop: 40 },
  body: { fontSize: 15, color: colors.textSecondary, lineHeight: 21 },
  input: {
    height: 50,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
  },
  error: { fontSize: 13, color: colors.error },
  button: {
    height: 50,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600', color: colors.text },
});
