import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChangePassword } from '@/hooks/useAuth';
import { showAlert } from '@/lib/alert';
import { ChangePasswordSchema } from '@/schemas';
import { colors, radii } from '@/lib/theme';

export default function ChangePasswordModal() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync: changePassword, isPending } = useChangePassword();

  async function submit() {
    setError(null);
    const parsed = ChangePasswordSchema.safeParse({ current, next });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your passwords.');
      return;
    }
    try {
      await changePassword(parsed.data);
      router.back();
      showAlert('Password changed', 'Use your new password next time you sign in.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your password.');
    }
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Change password</Text>
            <TouchableOpacity onPress={submit} disabled={isPending} accessibilityRole="button" accessibilityLabel="Save password">
              {isPending ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.saveText}>Save</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Current password</Text>
            <TextInput
              style={styles.input}
              value={current}
              onChangeText={(t) => { setCurrent(t); setError(null); }}
              secureTextEntry
              autoComplete="current-password"
              autoFocus
              accessibilityLabel="Current password"
            />
            <Text style={[styles.label, { marginTop: 20 }]}>New password</Text>
            <TextInput
              style={styles.input}
              value={next}
              onChangeText={(t) => { setNext(t); setError(null); }}
              secureTextEntry
              autoComplete="new-password"
              onSubmitEditing={submit}
              accessibilityLabel="New password"
            />
            <Text style={styles.hint}>At least 8 characters.</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelText: { fontSize: 16, color: colors.textSecondary },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  saveText: { fontSize: 16, fontWeight: '600', color: colors.accent },
  form: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, letterSpacing: 0.2 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  hint: { fontSize: 13, color: colors.textTertiary, marginTop: 6 },
  error: { fontSize: 14, color: colors.error, marginTop: 16 },
});
