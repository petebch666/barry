import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Fleshed out in Phase 3
export default function CreatePingModal() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.placeholder}>
        <Text style={styles.text}>Send a Ping</Text>
        <Text style={styles.sub}>Group selector, message, and time picker coming in Phase 3.</Text>
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
