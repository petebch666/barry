import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { showAlert } from '@/lib/alert';
import { useSendFeedback } from '@/hooks/useFeedback';
import { SendFeedbackSchema, type FeedbackRating } from '@/schemas';
import { colors, radii } from '@/lib/theme';

const MAX_LENGTH = 1000;

export default function FeedbackModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ pingId?: string; rating?: string }>();
  const pingId = params.pingId;
  const isOutcome = !!pingId;
  const [rating, setRating] = useState<FeedbackRating | null>(
    params.rating === 'up' || params.rating === 'down' ? params.rating : null,
  );
  const [message, setMessage] = useState('');
  const { mutateAsync: sendFeedback, isPending } = useSendFeedback();

  const input = isOutcome
    ? { kind: 'ping_outcome' as const, ping_id: pingId, rating: rating ?? undefined, message }
    : { kind: 'general' as const, message, rating: rating ?? undefined };
  const canSubmit = SendFeedbackSchema.safeParse(input).success && !isPending;

  async function submit() {
    const parsed = SendFeedbackSchema.safeParse(input);
    if (!parsed.success) {
      showAlert('Almost there', parsed.error.issues[0]?.message ?? 'Check your feedback.');
      return;
    }
    try {
      await sendFeedback(parsed.data);
      router.back();
      showAlert('Thanks!', 'Your feedback helps make Barry better.');
    } catch (err) {
      showAlert('Error', err instanceof Error ? err.message : 'Could not send your feedback.');
    }
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{isOutcome ? 'How did it go?' : 'Send feedback'}</Text>
            <TouchableOpacity
              onPress={submit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="Send feedback"
            >
              {isPending ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={[styles.sendText, !canSubmit && styles.sendDisabled]}>Send</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>
              {isOutcome ? 'Choosing the place went…' : 'Overall, Barry is… (optional)'}
            </Text>
            <View style={styles.ratingRow}>
              {(['up', 'down'] as const).map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.ratingBtn, rating === value && styles.ratingBtnActive]}
                  onPress={() => setRating(rating === value ? null : value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: rating === value }}
                  accessibilityLabel={value === 'up' ? 'Went well' : 'Went badly'}
                >
                  <Text style={styles.ratingEmoji}>{value === 'up' ? '👍' : '👎'}</Text>
                  <Text style={[styles.ratingText, rating === value && styles.ratingTextActive]}>
                    {value === 'up' ? (isOutcome ? 'Well' : 'Working well') : (isOutcome ? 'Badly' : 'Frustrating')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 24 }]}>
              {isOutcome ? 'What happened? (optional)' : 'What worked, what didn\'t?'}
            </Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={message}
              onChangeText={setMessage}
              placeholder={isOutcome
                ? 'The suggestions, the vote, the meeting point…'
                : 'A bug, something confusing, an idea…'}
              placeholderTextColor={colors.textTertiary}
              maxLength={MAX_LENGTH}
              multiline
              autoFocus={!isOutcome}
              accessibilityLabel="Feedback message"
            />
            <Text style={styles.charCount}>{message.length}/{MAX_LENGTH}</Text>
            <Text style={styles.hint}>
              Your name and app version are sent with it, so we can follow up.
            </Text>
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
  sendText: { fontSize: 16, fontWeight: '600', color: colors.accent },
  sendDisabled: { color: colors.textTertiary },
  form: { padding: 20 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  ratingRow: { flexDirection: 'row', gap: 12 },
  ratingBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 14,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  ratingBtnActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  ratingEmoji: { fontSize: 24 },
  ratingText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  ratingTextActive: { color: colors.text, fontWeight: '600' },
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
  inputMultiline: { height: 140, textAlignVertical: 'top' },
  charCount: { fontSize: 12, color: colors.textTertiary, alignSelf: 'flex-end', marginTop: 4 },
  hint: { fontSize: 13, color: colors.textTertiary, marginTop: 12 },
});
