import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/lib/theme';

interface State { hasError: boolean; }

export class MapErrorBoundary extends React.Component<React.PropsWithChildren<object>, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.fallback}>
          <Text style={styles.icon}>🗺️</Text>
          <Text style={styles.text}>Map unavailable</Text>
          <Text style={styles.hint}>A Google Maps API key is required on Android.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallback: {
    height: 200,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  icon: { fontSize: 32 },
  text: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  hint: { fontSize: 12, color: colors.textTertiary, textAlign: 'center', paddingHorizontal: 24 },
});
