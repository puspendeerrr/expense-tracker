import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { notifications as notificationsApi } from '@/api/endpoints';
import type { AppNotification, NotificationListPayload } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useNotifications } from '@/notifications/NotificationProvider';
import { routeForNotification } from '@/notifications/routing';
import { Badge, Card, CardSkeleton, SectionHeader } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { dayBucket, formatInstant } from '@/lib/money';

/**
 * Notifications Inbox with day grouping, category iconography, and tactile cards.
 */

const PAGE = 20;

type CategoryConfig = {
  label: string;
  tone: 'neutral' | 'negative' | 'info' | 'warning';
  icon: IconName;
};

const CATEGORY: Record<string, CategoryConfig> = {
  expense_added: { label: 'Expense', tone: 'neutral', icon: 'tag' },
  expense_updated: { label: 'Expense', tone: 'neutral', icon: 'edit' },
  expense_deleted: { label: 'Expense', tone: 'neutral', icon: 'trash' },
  settlement_requested: { label: 'Settlement', tone: 'warning', icon: 'clock' },
  settlement_approved: { label: 'Settlement', tone: 'info', icon: 'check' },
  settlement_rejected: { label: 'Settlement', tone: 'negative', icon: 'close' },
  payment_reminder: { label: 'Reminder', tone: 'warning', icon: 'bell' },
  member_joined: { label: 'Group', tone: 'neutral', icon: 'users' },
  security_new_device: { label: 'Security', tone: 'negative', icon: 'shield' },
  security_password_changed: { label: 'Security', tone: 'negative', icon: 'shield' },
  security_session_revoked: { label: 'Security', tone: 'negative', icon: 'shield' },
};

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { setUnreadCount, refreshUnread } = useNotifications();

  const [limit, setLimit] = useState(PAGE);
  const [busy, setBusy] = useState(false);
  const [readLocally, setReadLocally] = useState<Set<string>>(new Set());

  const request = useRequest<NotificationListPayload>(
    useCallback(
      (signal: AbortSignal) => notificationsApi.list({ limit }, signal),
      [limit],
    ),
    [limit],
  );

  const rows = request.data?.notifications ?? [];
  const unread = Math.max(0, (request.data?.unreadCount ?? 0) - readLocally.size);
  const hasMore = request.data?.pagination.hasMore ?? false;

  const isRead = (item: AppNotification): boolean => item.isRead || readLocally.has(item.id);

  const open = (item: AppNotification): void => {
    if (!isRead(item)) {
      setReadLocally((current) => new Set(current).add(item.id));
      void notificationsApi.markRead([item.id]).then(({ unreadCount }) => {
        setUnreadCount(unreadCount);
      });
    }

    const target = routeForNotification({
      type: item.type,
      groupId: item.groupId,
      entityType: item.entityType,
      entityId: item.entityId,
    });
    if (target) router.push(target as never);
  };

  const markAll = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const { unreadCount } = await notificationsApi.markAllRead();
      setUnreadCount(unreadCount);
      await request.refresh();
      setReadLocally(new Set());
    } finally {
      setBusy(false);
    }
  };

  const days = useMemo(() => {
    const out: { label: string; items: AppNotification[] }[] = [];
    for (const item of rows) {
      const label = dayBucket(item.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(item);
      else out.push({ label, items: [item] });
    }
    return out;
  }, [rows]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Notifications"
        subtitle={unread > 0 ? unread + ' unread' : 'All caught up'}
        right={
          unread > 0 ? (
            <PrimaryButton
              label="Mark all read"
              variant="secondary"
              loading={busy}
              onPress={() => void markAll()}
              style={styles.headerButton}
            />
          ) : undefined
        }
      />

      {request.loading && !request.data ? (
        <View style={styles.body}>
          <CardSkeleton rows={5} />
        </View>
      ) : request.error && !request.data ? (
        <ErrorState error={request.error} onRetry={() => void request.refresh()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          message="When expenses or settlements are recorded in your groups, they will appear here."
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={request.refreshing}
              onRefresh={() => {
                void request.refresh();
                void refreshUnread();
              }}
              colors={[colors.primary]}
              tintColor={colors.primary}
              progressBackgroundColor={colors.surface}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {days.map((day) => (
            <View key={day.label} style={styles.dayGroup}>
              <SectionHeader title={day.label} />
              {day.items.map((item) => {
                const read = isRead(item);
                const cat = CATEGORY[item.type] ?? { label: 'Update', tone: 'neutral' as const, icon: 'bell' as IconName };

                return (
                  <Card
                    key={item.id}
                    onPress={() => open(item)}
                    accessibilityLabel={
                      (read ? '' : 'Unread. ') + item.title + '. ' + item.message
                    }
                  >
                    <View style={styles.row}>
                      {/* Icon Circle */}
                      <View
                        style={[
                          styles.iconBadge,
                          {
                            backgroundColor: read ? colors.subtle : colors.primarySubtle,
                          },
                        ]}
                      >
                        <Icon
                          name={cat.icon}
                          size={18}
                          tone={read ? 'muted' : 'primary'}
                        />
                      </View>

                      {/* Content */}
                      <View style={styles.rowBody}>
                        <View style={styles.titleRow}>
                          <Text
                            numberOfLines={1}
                            style={{
                              color: colors.text,
                              fontSize: typography.bodySm,
                              fontWeight: read ? '600' : '800',
                              flex: 1,
                            }}
                          >
                            {item.title}
                          </Text>
                          {!read ? (
                            <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                          ) : null}
                        </View>

                        <Text
                          numberOfLines={3}
                          style={{ color: colors.muted, fontSize: typography.caption, lineHeight: 18 }}
                        >
                          {item.message}
                        </Text>

                        <View style={styles.metaRow}>
                          <Badge label={cat.label} tone={cat.tone} />
                          <Text style={{ color: colors.muted, fontSize: typography.xs }}>
                            {formatInstant(item.createdAt)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          ))}

          {hasMore ? (
            <PrimaryButton
              label={request.refreshing ? 'Loading…' : 'Load more notifications'}
              variant="secondary"
              loading={request.refreshing}
              onPress={() => setLimit((val) => val + PAGE)}
            />
          ) : (
            <Text style={[styles.endText, { color: colors.muted }]}>
              {rows.length === 1 ? '1 notification' : rows.length + ' notifications'}
            </Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 1.5,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  headerButton: {
    minHeight: 34,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
  },
  dayGroup: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rowBody: {
    flex: 1,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: 2,
  },
  endText: {
    fontSize: typography.caption,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});
