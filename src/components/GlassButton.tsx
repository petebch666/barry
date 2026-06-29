import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  type TouchableOpacityProps,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radii } from '@/lib/theme';

interface GlassButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  size?: 'sm' | 'md';
}

export function GlassButton({
  label,
  variant = 'primary',
  loading = false,
  size = 'md',
  style,
  disabled,
  ...props
}: GlassButtonProps) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isGhost = variant === 'ghost';

  return (
    <TouchableOpacity
      style={[
        styles.base,
        size === 'sm' && styles.sm,
        isPrimary && styles.primary,
        isDanger && styles.danger,
        isGhost && styles.ghost,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      disabled={disabled || loading}
      accessibilityRole="button"
      {...props}
    >
      {isGhost && (
        <>
          <BlurView
            tint="dark"
            intensity={40}
            style={styles.absoluteFillNoEvents}
            pointerEvents="none"
          />
          <View style={styles.ghostOverlay} />
        </>
      )}
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={[styles.label, size === 'sm' && styles.labelSm]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    overflow: 'hidden',
  },
  sm: { height: 38, paddingHorizontal: 16 },
  primary: { backgroundColor: colors.accent },
  danger: { backgroundColor: colors.error },
  ghost: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  absoluteFillNoEvents: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  ghostOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    pointerEvents: 'none',
  },
  disabled: { opacity: 0.45 },
  label: { color: colors.text, fontSize: 16, fontWeight: '600' },
  labelSm: { fontSize: 14 },
});
