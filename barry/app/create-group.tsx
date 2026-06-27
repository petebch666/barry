import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCreateGroup } from '@/hooks/useGroups';

export default function CreateGroupModal() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { mutateAsync: createGroup, isPending } = useCreateGroup();

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please give your group a name.');
      return;
    }
    try {
      const group = await createGroup({ name: trimmed, description: description.trim() || undefined });
      router.replace(`/(app)/(groups)/${group.id}`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not create group.');
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
          <Text style={styles.title}>New Group</Text>
          <TouchableOpacity
            onPress={submit}
            disabled={isPending || !name.trim()}
            accessibilityRole="button"
            accessibilityLabel="Create group"
          >
            {isPending ? (
              <ActivityIndicator color="#3B82F6" />
            ) : (
              <Text style={[styles.create, !name.trim() && styles.createDisabled]}>Create</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Group name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Friends, Work, Football…"
            placeholderTextColor="#94A3B8"
            maxLength={50}
            autoFocus
            returnKeyType="next"
            accessibilityLabel="Group name"
          />

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="What's this group for?"
            placeholderTextColor="#94A3B8"
            maxLength={200}
            multiline
            numberOfLines={3}
            accessibilityLabel="Group description"
          />
          <Text style={styles.hint}>{description.length}/200</Text>
        </View>
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
  create: { fontSize: 16, fontWeight: '600', color: '#3B82F6' },
  createDisabled: { color: '#CBD5E1' },
  form: { padding: 20, gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748B', marginTop: 16, marginBottom: 4 },
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
  inputMultiline: { height: 80, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: '#94A3B8', alignSelf: 'flex-end' },
});
