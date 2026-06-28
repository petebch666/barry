import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCreateGroup } from '@/hooks/useGroups';
import { colors, radii } from '@/lib/theme';

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
      router.replace(`/(app)/(groups)/${group.id}` as never);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not create group.');
    }
  }

  const canSubmit = !!name.trim() && !isPending;

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.navBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>New Group</Text>
            <TouchableOpacity
              onPress={submit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="Create group"
            >
              {isPending ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={[styles.createText, !canSubmit && styles.createDisabled]}>
                  Create
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Group name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Friends, Work, Football…"
              placeholderTextColor={colors.textTertiary}
              maxLength={50}
              autoFocus
              returnKeyType="next"
              accessibilityLabel="Group name"
            />

            <Text style={[styles.label, { marginTop: 20 }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="What's this group for? (optional)"
              placeholderTextColor={colors.textTertiary}
              maxLength={200}
              multiline
              numberOfLines={3}
              accessibilityLabel="Group description"
            />
            <Text style={styles.charCount}>{description.length}/200</Text>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelText: { fontSize: 16, color: colors.textSecondary },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  createText: { fontSize: 16, fontWeight: '600', color: colors.accent },
  createDisabled: { color: colors.textTertiary },
  form: { padding: 20 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputMultiline: { height: 84, textAlignVertical: 'top' },
  charCount: {
    fontSize: 12,
    color: colors.textTertiary,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
});
