import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';

/** Signed-in people have no business on the sign-in screen; send them home. */
export default function AuthLayout() {
  const { status } = useAuth();
  if (status === 'authenticated') return <Redirect href="/home" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
