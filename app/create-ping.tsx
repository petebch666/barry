import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCreatePing } from '@/hooks/usePings';
import { useGroups } from '@/hooks/useGroups';
import { colors, radii } from '@/lib/theme';
import type { Group } from '@/schemas';

export default function CreatePingModal() {
  const router = useRouter();
  const { data: groups, isLoading: groupsLoading } = useGroups();
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

  const canSend = !!selectedGroupId && !!message.trim();

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
            disabled={isPending || !canSend}
            accessibilityRole="button"
            accessibilityLabel="Send ping"
          >
            {isPending ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={[styles.send, !canSend && styles.sendDisabled]}>Send</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Ping which group? *</Text>
          {!groupsLoading && (groups ?? []).length === 0 ? (
            <View style={styles.noGroupBox}>
              <Text style={styles.noGroupText}>
                You need a group before you can ping.
              </Text>
              <TouchableOpacity
                style={styles.noGroupBtn}
                onPress={() => router.push('/create-group')}
                accessibilityRole="button"
                accessibilityLabel="Create your first group"
              >
                <Text style={styles.noGroupBtnText}>Create your first group →</Text>
              </TouchableOpacity>
            </View>
          ) : (
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
          )}

          <Text style={styles.label}>Message *</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={message}
            onChangeText={setMessage}
            placeholder="Anyone for a drink tonight?"
            placeholderTextColor={colors.textTertiary}
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
                Your ping will be sent to all members of{' '}
                <Text style={styles.summaryBold}>{selectedGroup.name}</Text>.
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
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancel: { fontSize: 16, color: colors.textSecondary },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  send: { fontSize: 16, fontWeight: '600', color: colors.accent },
  sendDisabled: { color: colors.textTertiary },
  form: { padding: 20, gap: 6 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  groupChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  groupChipSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  groupChipText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  groupChipTextSelected: { color: colors.accent, fontWeight: '600' },
  noGroupBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  noGroupText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  noGroupBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  noGroupBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  inputMultiline: { height: 100, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: colors.textTertiary, alignSelf: 'flex-end' },
  summary: {
    marginTop: 20,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  summaryText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  summaryBold: { fontWeight: '600', color: colors.text },
});
