import { View, Text, StyleSheet } from 'react-native';
import { GlassCard } from '@/components/GlassCard';
import { colors } from '@/lib/theme';

interface PingMapProps {
  barycenter: { latitude: number; longitude: number };
  memberLocations: Array<{ id: string; latitude: number; longitude: number }>;
  places: Array<{ id: string; latitude: number; longitude: number; name: string }>;
}

export default function PingMap({ barycenter }: PingMapProps) {
  return (
    <GlassCard style={styles.container}>
      <Text style={styles.icon}>📍</Text>
      <Text style={styles.label}>Meeting point</Text>
      <Text style={styles.coords}>
        {barycenter.latitude.toFixed(4)}, {barycenter.longitude.toFixed(4)}
      </Text>
      <Text style={styles.hint}>Open on mobile to see the map</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, alignItems: 'center', gap: 6 },
  icon: { fontSize: 28 },
  label: { fontSize: 16, fontWeight: '600', color: colors.text },
  coords: { fontSize: 13, color: colors.textSecondary, fontFamily: 'monospace' },
  hint: { fontSize: 12, color: colors.textTertiary, marginTop: 4 },
});
