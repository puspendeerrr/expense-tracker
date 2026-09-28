import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { admin } from '@/api/endpoints';
import type { AdminPermissionDefinition, AdminUserPermissions } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import {
  SMBadge,
  SMCard,
  SMDetailRow,
  SMErrorState,
  SMRowSkeleton,
  SMScreenHeader,
  SMSettingsGroup,
  SMSettingsRow,
} from '@/components/sm';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';

const CATEGORIES: { key: AdminPermissionDefinition['category']; title: string }[] = [
  { key: 'platform', title: 'Platform' },
  { key: 'groups', title: 'Groups' },
  { key: 'money', title: 'Money' },
  { key: 'insights', title: 'Insights' },
];

const scopeLabel = (scope: AdminUserPermissions['dashboardScope']): string =>
  scope.kind === 'all_groups'
    ? 'Every group'
    : scope.kind === 'selected_groups'
      ? scope.groupIds.length + (scope.groupIds.length === 1 ? ' selected group' : ' selected groups')
      : 'None';

/**
 * What one person may do, as the server resolves it: the registry's defaults for their
 * role, with any explicit overrides marked. Read-only — the effective set is the server's
 * answer, not something worked out here.
 */
export default function AdminUserPermissionsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { userId = '', name } = useLocalSearchParams<{ userId: string; name?: string }>();
  const { data, error, loading, refreshing, refresh } = useRequest(
    (signal) => admin.userPermissions(userId, signal),
    [userId],
  );

  const back = (): void => (router.canGoBack() ? router.back() : router.replace('/admin/users' as never));
  const granted = new Set(data?.permissions ?? []);
  const override = new Map((data?.overrides ?? []).map((o) => [o.permission, o.effect]));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <SMScreenHeader title="Permissions" subtitle={name || 'Admin console'} onBack={back} />
      {loading ? (
        <SMRowSkeleton rows={6} />
      ) : error && !data ? (
        <SMErrorState error={error} onRetry={() => void refresh()} />
      ) : data ? (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} colors={[colors.primary]} />
          }
        >
          <SMCard style={styles.card}>
            <SMDetailRow label="Role" value={data.role === 'admin' ? 'Administrator' : 'Member'} />
            <SMDetailRow label="Granted" value={granted.size + ' of ' + data.registry.length} />
            <SMDetailRow label="Overrides" value={data.overrides.length === 0 ? 'None' : String(data.overrides.length)} />
            <SMDetailRow label="Dashboard" value={scopeLabel(data.dashboardScope)} />
          </SMCard>

          {CATEGORIES.map(({ key, title }) => {
            const items = data.registry.filter((p) => p.category === key);
            if (items.length === 0) return null;
            return (
              <SMSettingsGroup key={key} title={title}>
                {items.map((p) => {
                  const effect = override.get(p.key);
                  return (
                    <SMSettingsRow
                      key={p.key}
                      title={p.label}
                      subtitle={p.description}
                      icon={granted.has(p.key) ? 'checkCircle' : 'close'}
                      trailing={
                        effect ? (
                          <SMBadge label={effect === 'allow' ? 'Allowed' : 'Denied'} tone={effect === 'allow' ? 'success' : 'danger'} />
                        ) : p.sensitive ? (
                          <SMBadge label="Sensitive" tone="warning" />
                        ) : undefined
                      }
                    />
                  );
                })}
              </SMSettingsGroup>
            );
          })}

          <Text style={[styles.note, { color: colors.muted }]}>
            A tick means the server grants it. “Allowed” and “Denied” mark an override of the role’s default.
          </Text>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: spacing.base, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  card: { padding: spacing.md, gap: spacing.sm },
  note: { fontSize: typography.caption, textAlign: 'center', lineHeight: 18 },
});
