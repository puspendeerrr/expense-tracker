import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { notifications as notificationsApi } from '@/api/endpoints';
import { describeError } from '@/api/errors';
import type { AppNotification, NotificationListPayload, NotificationType } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useNotifications } from '@/notifications/NotificationProvider';
import { routeForNotification } from '@/notifications/routing';
import { groupByDay } from '@/features/group/ledger';
import {
  SMButton,
  SMCard,
  SMDateHeader,
  SMEmptyState,
  SMErrorState,
  SMInlineNotice,
  SMNotificationItem,
  SMRowSkeleton,
  SMScreenHeader,
  type SMNotificationKind,
} from '@/components/sm';
import type { IconName } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';
import { relativeTime } from '@/lib/time';

const PAGE = 30;

/** The server's eleven notification types, and how each is marked. */
const LOOK: Record<NotificationType, { kind: SMNotificationKind; icon: IconName }> = {
  expense_added: { kind: 'expense', icon: 'add' },
  expense_updated: { kind: 'expense', icon: 'edit' },
  expense_deleted: { kind: 'expense', icon: 'trash' },
  settlement_requested: { kind: 'payment', icon: 'settlement' },
  settlement_approved: { kind: 'payment', icon: 'checkCircle' },
  settlement_rejected: { kind: 'payment', icon: 'alertCircle' },
  payment_reminder: { kind: 'reminder', icon: 'bell' },
  member_joined: { kind: 'member', icon: 'userPlus' },
  security_new_device: { kind: 'security', icon: 'smartphone' },
  security_password_changed: { kind: 'security', icon: 'lock' },
  security_session_revoked: { kind: 'security', icon: 'shield' },
};

/**
 * What was sent to you.
 *
 * Not the activity feed: that is what happened in a group; this is what the server chose
 * to tell YOU, in its own words. Titles and messages are shown exactly as stored.
 *
 * READ STATE STAYS THE SERVER'S. Opening an unread notification marks it read straight
 * away on screen and asks the server to do the same. If the server refuses, the row goes
 * back to unread and the badge is re-read — the previous screen ignored that failure, so
 * the row looked read while the badge still counted it.
 *
 * LIVE WITHOUT GUESSING. The provider keeps the authoritative unread count (from push and
 * realtime). When it rises while this screen is open, the list is re-read from the server
 * and replaced. Nothing is built from a push payload, so nothing can appear twice.
 */
export default function NotificationsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { unreadCount, setUnreadCount, refreshUnread, permission, push, enablePush } = useNotifications();

  const [limit, setLimit] = useState(PAGE);
  const [markingAll, setMarkingAll] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [readLocally, setReadLocally] = useState<Set<string>>(new Set());
  const [enabling, setEnabling] = useState(false);

  const request = useRequest<NotificationListPayload>(
    useCallback((signal: AbortSignal) => notificationsApi.list({ limit }, signal), [limit]),
    [limit],
  );

  // Something new arrived while we were looking: read the list again.
  const lastCount = useRef(unreadCount);
  useEffect(() => {
    if (unreadCount > lastCount.current) void request.refresh();
    lastCount.current = unreadCount;
  }, [unreadCount]);

  const rows = request.data?.notifications ?? [];
  const hasMore = request.data?.pagination.hasMore ?? false;
  const isRead = (item: AppNotification): boolean => item.isRead || readLocally.has(item.id);
  const unread = rows.filter((item) => !isRead(item)).length;
  const totalUnread = Math.max(unread, request.data ? unreadCount : 0);

  const days = useMemo(() => groupByDay(rows, (item) => item.createdAt), [rows]);

  const open = (item: AppNotification): void => {
    if (!isRead(item)) {
      setReadLocally((current) => new Set(current).add(item.id));
      notificationsApi
        .markRead([item.id])
        .then(({ unreadCount: count }) => setUnreadCount(count))
        .catch(() => {
          // Put it back as the server has it, and re-read the badge.
          setReadLocally((current) => {
            const next = new Set(current);
            next.delete(item.id);
            return next;
          });
          void refreshUnread();
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
    if (markingAll) return;
    setMarkingAll(true);
    setProblem(null);
    try {
      const { unreadCount: count } = await notificationsApi.markAllRead();
      setUnreadCount(count);
      await request.refresh();
      setReadLocally(new Set());
    } catch (caught: unknown) {
      setProblem(describeError(caught).message);
    } finally {
      setMarkingAll(false);
    }
  };

  const back = (): void => (router.canGoBack() ? router.back() : router.replace('/home'));

  const askable = !permission.granted && permission.canAskAgain && push.status !== 'unsupported';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <SMScreenHeader
        title="Notifications"
        onBack={back}
        action={{
          icon: 'settings',
          label: 'Notification settings',
          onPress: () => router.push('/settings/notifications' as never),
        }}
      />

      {request.loading && !request.data ? (
        <View style={styles.body}>
          <SMRowSkeleton rows={6} bordered={false} />
        </View>
      ) : request.error && !request.data ? (
        <SMErrorState error={request.error} onRetry={() => void request.refresh()} />
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
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {askable ? (
            <SMCard style={styles.permission}>
              <Text style={[styles.permissionTitle, { color: colors.text }]}>Get notified on this phone</Text>
              <Text style={[styles.permissionText, { color: colors.muted }]}>
                Payments waiting for you, new expenses and security alerts, without opening the app.
              </Text>
              <SMButton
                label="Turn on notifications"
                icon="bell"
                variant="primary"
                loading={enabling}
                onPress={async () => {
                  setEnabling(true);
                  try {
                    await enablePush();
                  } finally {
                    setEnabling(false);
                  }
                }}
              />
            </SMCard>
          ) : null}

          {rows.length > 0 ? (
            <View style={styles.context}>
              <Text style={[styles.contextText, { color: colors.muted }]}>
                {totalUnread > 0 ? totalUnread + ' unread' : 'All caught up'}
              </Text>
              {unread > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mark all as read"
                  accessibilityState={{ busy: markingAll }}
                  disabled={markingAll}
                  onPress={() => void markAll()}
                  hitSlop={10}
                  style={({ pressed }) => ({ opacity: pressed || markingAll ? 0.5 : 1 })}
                >
                  <Text style={[styles.markAll, { color: colors.primary }]}>
                    {markingAll ? 'Marking…' : 'Mark all as read'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {problem ? <SMInlineNotice type="error" message={problem} /> : null}

          {rows.length === 0 ? (
            <SMEmptyState
              icon="bell"
              title="You’re all caught up"
              description="Payments that need you, new expenses and security alerts will show up here."
            />
          ) : (
            days.map((day) => (
              <View key={day.label} style={styles.day}>
                <SMDateHeader label={day.label} />
                <SMCard style={styles.dayCard}>
                  {day.rows.map((item) => {
                    const look = LOOK[item.type] ?? { kind: 'member' as const, icon: 'bell' as IconName };
                    const target = routeForNotification({
                      type: item.type,
                      groupId: item.groupId,
                      entityType: item.entityType,
                      entityId: item.entityId,
                    });
                    return (
                      <SMNotificationItem
                        key={item.id}
                        title={item.title}
                        message={item.message}
                        timeLabel={relativeTime(item.createdAt)}
                        kind={look.kind}
                        icon={look.icon}
                        unread={!isRead(item)}
                        // Always openable when unread, so tapping can at least mark it read.
                        {...(target || !isRead(item) ? { onPress: () => open(item) } : {})}
                      />
                    );
                  })}
                </SMCard>
              </View>
            ))
          )}

          {hasMore ? (
            <SMButton
              label={request.refreshing ? 'Loading…' : 'Load older notifications'}
              variant="secondary"
              loading={request.refreshing}
              onPress={() => setLimit((value) => value + PAGE)}
            />
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: spacing.base, gap: spacing.md, paddingBottom: spacing.xxl },
  permission: { padding: spacing.base, gap: spacing.sm },
  permissionTitle: { fontSize: typography.body, fontWeight: '800' },
  permissionText: { fontSize: typography.caption, lineHeight: 18 },
  context: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contextText: { fontSize: typography.caption, fontWeight: '600' },
  markAll: { fontSize: typography.caption, fontWeight: '700' },
  day: { gap: spacing.xs },
  dayCard: { padding: spacing.xs, gap: 2 },
});
