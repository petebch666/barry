import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '@/lib/theme';
import type { PlaceRatingValue } from '@/schemas';

const RATING_COLOR: Record<PlaceRatingValue, string> = {
  loved_it: colors.success,
  it_was_fine: colors.warning,
  not_for_me: colors.error,
};

const RATING_LABEL: Record<PlaceRatingValue, string> = {
  loved_it: 'Loved it',
  it_was_fine: 'It was fine',
  not_for_me: 'Not for me',
};

interface RatingPillProps {
  rating: PlaceRatingValue;
  /** Rollup mode — shows a count next to the label, not tappable. */
  count?: number;
  /** Selection mode — tappable, filled when selected. */
  selected?: boolean;
  onPress?: () => void;
}

export function RatingPill({ rating, count, selected, onPress }: RatingPillProps) {
  const color = RATING_COLOR[rating];
  const content = (
    <View style={[styles.chip, selected && { backgroundColor: color + '28' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>
        {RATING_LABEL[rating]}{count != null ? ` (${count})` : ''}
      </Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={RATING_LABEL[rating]}
      accessibilityState={{ selected: !!selected }}
    >
      {content}
    </TouchableOpacity>
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
  label: { fontSize: 12, fontWeight: '600' },
});
