import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroups } from '@/hooks/useGroups';
import { GlassCard } from '@/components/GlassCard';
import { colors, BOTTOM_TAB_PADDING } from '@/lib/theme';
import type { Group } from '@/schemas';

// This screen is hidden from the tab bar (href: null).
// Groups are shown on the Profile tab. This route is still navigable via router.push.

export default function GroupsListScreen() {
  const router = useRouter();
  const { data: groups, isLoading, refetch, isRefetching } = useGroups();

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.heading}>Groups</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/create-group')}
            accessibilityRole="button"
            accessibilityLabel="Create a group"
          >
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={groups ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
          renderItem={({ item }) => <GroupCard group={item} />}
          ListEmptyComponent={
            isLoading ? null : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No groups yet</Text>
                <Text style={styles.emptyHint}>
                  Create a group or ask a friend for an invite link.
                </Text>
              </View>
            )
          }
        />
      </SafeAreaView>
    </View>
  );
}

function GroupCard({ group }: { group: Group }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push(`/(app)/(groups)/${group.id}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`Open group: ${group.name}`}
      activeOpacity={0.75}
    >
      <GlassCard style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{group.name[0].toUpperCase()}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.groupName}>{group.name}</Text>
          {group.description ? (
            <Text style={styles.description} numberOfLines={1}>{group.description}</Text>
          ) : null}
        </View>
        <Text style={styles.chevron}>›</Text>
      </GlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  heading: { fontSize: 34, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addBtnText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: BOTTOM_TAB_PADDING, gap: 8 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: colors.accent },
  cardBody: { flex: 1 },
  groupName: { fontSize: 16, fontWeight: '600', color: colors.text },
  description: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.textTertiary },
  empty: { paddingTop: 80, alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { fontSize: 18, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  emptyHint: { fontSize: 15, color: colors.textTertiary, textAlign: 'center', lineHeight: 22 },
});
