import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.placeholder}>
        <Text style={styles.text}>Group {id}</Text>
        <Text style={styles.sub}>Members, pings, and invite flow coming in Phase 3.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  text: { fontSize: 20, fontWeight: '600', color: '#1E293B', marginBottom: 8 },
  sub: { fontSize: 14, color: '#64748B', textAlign: 'center' },
});
