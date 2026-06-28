import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, BOTTOM_TAB_PADDING } from '@/lib/theme';

// This tab is hidden from the tab bar (href: null in _layout.tsx).
// Map content lives inside individual ping detail screens via PingMap.native.tsx.

export default function MapScreen() {
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.title}>Map</Text>
        <Text style={styles.subtitle}>Open a ping to see the map.</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    paddingBottom: BOTTOM_TAB_PADDING,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.textSecondary, textAlign: 'center' },
});
