import { useCallback } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { GroupCard } from '@/components/GroupCard';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui';
import { useAuth } from '@/auth/AuthProvider';
import { useNotifications } from '@/notifications/NotificationProvider';
import { AdBanner, AD_PLACEMENTS } from '@/features/ads';
import { useRequest } from '@/hooks/useRequest';
import { groups as groupsApi } from '@/api/endpoints';
import type { Group } from '@/api/types';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/theme/tokens';

export default function HomeScreen() {
  const { colors, dark } = useTheme();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const router = useRouter();

  const request = useRequest<{ groups: Group[] }>(
    useCallback((signal: AbortSignal) => groupsApi.list(signal), []),
    [],
  );

  const list = request.data?.groups ?? [];
  const firstName = user?.fullName?.trim().split(/\s+/)[0] ?? 'there';

  const body = (): React.ReactElement => {
    if (request.loading && request.data === undefined) {
      return <LoadingState label="Loading your groups…" />;
    }

    if (request.error && request.data === undefined) {
      return <ErrorState error={request.error} onRetry={() => void request.refresh()} />;
    }

    if (list.length === 0) {
      return (
        <EmptyState
          title="No groups yet"
          message="Create a group for an apartment, trip, or night out — or join an existing one with an invite code."
          icon="group"
          action={{
            label: 'Create a group',
            onPress: () => router.push('/new-group'),
            variant: 'primary',
          }}
        />
      );
    }

    return (
      <FlatList
        data={list}
        keyExtractor={(group) => group.id}
        renderItem={({ item }) => (
          <GroupCard group={item} onPress={() => router.push(('/group/' + item.id) as never)} />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            {/* Quick Hero Banner */}
            <View
              style={[
                styles.heroBanner,
                { backgroundColor: colors.surface, borderColor: colors.border },
                !dark ? shadows.sm : null,
              ]}
            >
              <View style={styles.heroRow}>
                <Avatar name={user?.fullName ?? firstName} size={48} />
                <View style={styles.heroInfo}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: typography.body,
                      fontWeight: '700',
                    }}
                  >
                    Hi, {firstName} 👋
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                    {list.length === 1 ? '1 active group' : `${list.length} active groups`}
                  </Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <PrimaryButton
                  label="New Group"
                  icon="add"
                  variant="primary"
                  onPress={() => router.push('/new-group')}
                  style={{ flex: 1 }}
                />
                <PrimaryButton
                  label="Join"
                  icon="group"
                  variant="secondary"
                  onPress={() => router.push({ pathname: '/new-group', params: { mode: 'join' } })}
                  style={{ flex: 1 }}
                />
              </View>
            </View>

            {/* List section title */}
            <View style={styles.sectionHeader}>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: typography.xs,
                  fontWeight: '800',
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                }}
              >
                YOUR GROUPS ({list.length})
              </Text>
            </View>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={request.refreshing}
            onRefresh={() => void request.refresh()}
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressBackgroundColor={colors.surface}
          />
        }
      />
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <AppHeader
        title={firstName}
        subtitle={list.length === 1 ? '1 group' : `${list.length} groups`}
        right={
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'
              }
              onPress={() => router.push('/notifications')}
              hitSlop={8}
              style={[
                styles.iconBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Icon name="notifications" size={18} tone="default" />
              {unreadCount > 0 ? (
                <View style={[styles.notifBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.notifText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              onPress={() => router.push('/settings')}
              hitSlop={8}
              style={[
                styles.iconBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Icon name="settings" size={18} tone="default" />
            </Pressable>
          </>
        }
      />

      {request.error && request.data !== undefined ? (
        <View style={[styles.staleNotice, { backgroundColor: colors.subtle }]}>
          <Icon name="alert" size={14} tone="muted" />
          <Text style={{ color: colors.muted, fontSize: typography.caption }}>
            Showing cached data. Pull down to refresh.
          </Text>
        </View>
      ) : null}

      {body()}

      <AdBanner placement={AD_PLACEMENTS.home} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: spacing.base, gap: spacing.sm, flexGrow: 1 },
  headerBlock: { gap: spacing.base, marginBottom: spacing.xs },
  heroBanner: {
    padding: spacing.base,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroInfo: { flex: 1, gap: spacing.xxs },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionHeader: {
    paddingHorizontal: spacing.xxs,
    paddingTop: spacing.xs,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  staleNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
  },
});
