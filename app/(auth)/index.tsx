import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.wordmark}>barry</Text>
        <Text style={styles.subtitle}>
          Find the best spot to meet your friends — halfway between everyone.
        </Text>
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/(auth)/sign-in')}
        accessibilityRole="button"
        accessibilityLabel="Get started"
      >
        <Text style={styles.buttonText}>Get started</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'space-between',
    padding: 32,
    paddingTop: 100,
    paddingBottom: 56,
  },
  hero: { flex: 1, justifyContent: 'center' },
  wordmark: {
    fontSize: 72,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -3,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 20,
    color: colors.textSecondary,
    lineHeight: 28,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonText: { color: colors.text, fontSize: 17, fontWeight: '700' },
});
