import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';

/**
 * Only for accounts the server grants `admin.access` — the same capability every /admin
 * route checks. Anyone else is sent home rather than shown an empty console.
 *
 * This is navigation, not security: the server refuses every admin request from an
 * account without the capability, whatever the app does.
 */
export default function AdminLayout() {
  const { can } = useAuth();
  if (!can('admin.access')) return <Redirect href="/home" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
