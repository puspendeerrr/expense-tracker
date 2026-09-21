import { Redirect } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';

/**
 * The entry route. It decides nothing itself -- it forwards.
 *
 * While the session is still being restored it renders nothing rather than guessing, and
 * the splash overlay is what the user sees. Guessing here is exactly what produces a
 * login flash: a redirect to sign-in, then a redirect back a moment later.
 */
export default function Index() {
  const { status } = useAuth();

  if (status === 'authenticated') return <Redirect href="/home" />;
  if (status === 'anonymous') return <Redirect href="/sign-in" />;
  return null;
}
