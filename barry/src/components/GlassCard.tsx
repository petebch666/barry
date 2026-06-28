import { StyleSheet, View, type ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radii } from '@/lib/theme';

interface GlassCardProps extends ViewProps {
  intensity?: number;
}

export function GlassCard({ children, style, intensity = 50, ...props }: GlassCardProps) {
  return (
    <View style={[styles.container, style]} {...props}>
      <BlurView
        tint="dark"
        intensity={intensity}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.overlay} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
  },
  content: { flex: 1 },
});
