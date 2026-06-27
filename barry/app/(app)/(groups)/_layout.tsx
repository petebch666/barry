import { Stack } from 'expo-router';

export default function GroupsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Groups' }} />
      <Stack.Screen name="[id]" options={{ title: 'Group', headerBackTitle: 'Groups' }} />
      <Stack.Screen name="[id]/members" options={{ title: 'Members' }} />
    </Stack>
  );
}
