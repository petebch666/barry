import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { reportError } from '@/lib/reportError';
import { colors, radii } from '@/lib/theme';

export function ErrorScreen({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportError(error, { boundary: 'root' });
  }, [error]);

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>◎</Text>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.hint}>
        Barry hit an unexpected error. It has been noted; try again, and if it keeps happening, send us feedback from Settings.
      </Text>
      <TouchableOpacity style={styles.button} onPress={retry} accessibilityRole="button" accessibilityLabel="Try again">
        <Text style={styles.buttonText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
    backgroundColor: colors.bg,
  },
  icon: { fontSize: 40, color: colors.accent },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  hint: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  button: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  buttonText: { fontSize: 16, fontWeight: '600', color: colors.text },
});
