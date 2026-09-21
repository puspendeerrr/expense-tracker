import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { GroupProvider } from '@/features/group/GroupContext';

/**
 * Everything under a group shares one provider, so the group, its members and its
 * balances are fetched once and every screen below sees the same figures.
 */
export default function GroupLayout() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  // A malformed or missing id cannot address a group; go back rather than fetch nonsense.
  if (!groupId) return <Redirect href="/home" />;

  return (
    <GroupProvider groupId={groupId}>
      <Stack screenOptions={{ headerShown: false }} />
    </GroupProvider>
  );
}
