import { Redirect, Stack } from 'expo-router';
import { AiFab } from '@/components/AiFab';
import { useAuth } from '@/auth/AuthProvider';

/**
 * The guard for everything that needs a session.
 *
 * `restoring` and `unreachable` render nothing rather than redirecting. Both mean "we do
 * not know yet", and turning that into a redirect to sign-in would throw the user out
 * every time the app was opened on a bad connection. The boot overlay covers both.
 */
export default function AppLayout() {
  const { status } = useAuth();
  if (status === 'anonymous') return <Redirect href="/sign-in" />;
  if (status !== 'authenticated') return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      {/* One instance for every signed-in screen; it hides itself where it would intrude. */}
      <AiFab />
    </>
  );
}
