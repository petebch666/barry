import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCreatePing } from '@/hooks/usePings';
import { useGroups } from '@/hooks/useGroups';
import type { Group } from '@/schemas';

export default function CreatePingModal() {
  const router = useRouter();
  const { data: groups } = useGroups();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const { mutateAsync: createPing, isPending } = useCreatePing();

  const selectedGroup = groups?.find((g) => g.id === selectedGroupId);

  async function submit() {
    if (!selectedGroupId) {
      Alert.alert('Select a group', 'Please choose which group to ping.');
      return;
    }
    const trimmed = message.trim();
    if (!trimmed) {
      Alert.alert('Message required', 'Tell your friends why you\'re pinging them.');
      return;
    }
    try {
      const ping = await createPing({ group_id: selectedGroupId, message: trimmed });
      router.replace(`/(app)/(feed)/ping/${ping.id}`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not send ping.');
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Send a Ping</Text>
          <TouchableOpacity
            onPress={submit}
            disabled={isPending || !selectedGroupId || !message.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send ping"
          >
            {isPending ? (
              <ActivityIndicator color="#3B82F6" />
            ) : (
              <Text style={[
                styles.send,
                (!selectedGroupId || !message.trim()) && styles.sendDisabled,
              ]}>
                Send
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Ping which group? *</Text>
          <View style={styles.groupList}>
            {(groups ?? []).map((group: Group) => (
              <TouchableOpacity
                key={group.id}
                style={[
                  styles.groupChip,
                  selectedGroupId === group.id && styles.groupChipSelected,
                ]}
                onPress={() => setSelectedGroupId(group.id)}
                accessibilityRole="button"
                accessibilityLabel={`Select group: ${group.name}`}
                accessibilityState={{ selected: selectedGroupId === group.id }}
              >
                <Text style={[
                  styles.groupChipText,
                  selectedGroupId === group.id && styles.groupChipTextSelected,
                ]}>
                  {group.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Message *</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={message}
            onChangeText={setMessage}
            placeholder="Anyone for a drink tonight?"
            placeholderTextColor="#94A3B8"
            maxLength={500}
            multiline
            numberOfLines={3}
            autoFocus={!selectedGroupId}
            accessibilityLabel="Ping message"
          />
          <Text style={styles.hint}>{message.length}/500</Text>

          {selectedGroup && (
            <View style={styles.summary}>
              <Text style={styles.summaryText}>
                Your ping will be sent to all members of <Text style={styles.bold}>{selectedGroup.name}</Text>.
                It expires in 8 hours if no meetup is confirmed.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  cancel: { fontSize: 16, color: '#64748B' },
  title: { fontSize: 17, fontWeight: '600', color: '#1E293B' },
  send: { fontSize: 16, fontWeight: '600', color: '#3B82F6' },
  sendDisabled: { color: '#CBD5E1' },
  form: { padding: 20, gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748B', marginTop: 16, marginBottom: 8 },
  groupList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  groupChip: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  groupChipSelected: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  groupChipText: { fontSize: 14, fontWeight: '500', color: '#64748B' },
  groupChipTextSelected: { color: '#3B82F6', fontWeight: '600' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1E293B',
  },
  inputMultiline: { height: 100, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: '#94A3B8', alignSelf: 'flex-end' },
  summary: {
    marginTop: 20,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 14,
  },
  summaryText: { fontSize: 14, color: '#64748B', lineHeight: 20 },
  bold: { fontWeight: '600', color: '#1E293B' },
});
