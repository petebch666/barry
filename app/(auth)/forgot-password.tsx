import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRequestPasswordReset } from '@/hooks/useAuth';
import { EmailAuthSchema } from '@/schemas';
import { colors, radii } from '@/lib/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync: requestReset, isPending, isSuccess } = useRequestPasswordReset();

  async function submit() {
    setError(null);
    const parsed = EmailAuthSchema.shape.email.safeParse(email.trim());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid email address');
      return;
    }
    try {
      await requestReset(parsed.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the email.');
    }
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.container}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={styles.back}>‹ Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Reset your password</Text>

          {isSuccess ? (
            <Text style={styles.body}>
              If an account exists for {email.trim()}, we've sent it a link. Open it on this device to choose a new password.
            </Text>
          ) : (
            <>
              <Text style={styles.body}>Enter your account's email and we'll send you a link.</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                autoFocus
                onSubmitEditing={submit}
                accessibilityLabel="Email"
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity
                style={styles.button}
                onPress={submit}
                disabled={isPending}
                accessibilityRole="button"
                accessibilityLabel="Send reset link"
              >
                {isPending ? <ActivityIndicator color={colors.text} /> : <Text style={styles.buttonText}>Send link</Text>}
              </TouchableOpacity>
            </>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: 24, gap: 16 },
  back: { fontSize: 17, color: colors.accent, fontWeight: '500' },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, marginTop: 16 },
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
