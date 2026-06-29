import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/lib/theme';

const STATUS_COLOR: Record<string, string> = {
  open: '#3B82F6',
  voting: '#F59E0B',
  confirmed: '#10B981',
  cancelled: '#64748B',
};

interface BadgeProps {
  status: string;
}

export function Badge({ status }: BadgeProps) {
  const color = STATUS_COLOR[status] ?? colors.textTertiary;
  return (
    <View style={[styles.chip, { backgroundColor: color + '28' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
});
