import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useExchangeAuthCode } from '@/hooks/useAuth';
import { colors } from '@/lib/theme';

// Opened from the sign-up confirmation email. Once the code becomes a
// session, the root layout's route guard moves the user into the app.
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { code, error_description: linkError } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const exchange = useExchangeAuthCode(code);

  if (code && !linkError && !exchange.isError) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.body}>Confirming your account…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{linkError ? 'This link no longer works' : 'Your email is confirmed'}</Text>
      <Text style={styles.body}>
        {linkError
          ? `${linkError}. Sign in, and if your account isn't confirmed yet, sign up again to get a new link.`
          : "We couldn't sign you in automatically from this link. Sign in with your email and password."}
      </Text>
      <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')} accessibilityRole="button">
        <Text style={styles.link}>Go to sign in</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32,
    backgroundColor: colors.bg,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  link: { fontSize: 16, fontWeight: '600', color: colors.accent },
});
