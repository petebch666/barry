import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>Barry</Text>
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
    backgroundColor: '#F8FAFC',
    justifyContent: 'space-between',
    padding: 32,
    paddingTop: 80,
    paddingBottom: 48,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 56,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -2,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 20,
    color: '#64748B',
    lineHeight: 28,
  },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
