import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, radii } from '@/lib/theme';

export function LoadError({ onRetry, what = 'this' }: { onRetry: () => void; what?: string }) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.title}>Couldn't load {what}</Text>
      <Text style={styles.hint}>Check your connection and try again.</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        <Text style={styles.buttonText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 24 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' },
  hint: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  button: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  buttonText: { fontSize: 15, fontWeight: '600', color: colors.accent },
});
