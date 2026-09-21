import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { groups as groupsApi } from '@/api/endpoints';
import type { Activity, ActivityFilters, ActivityListPayload } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useGroup } from '../GroupContext';
import { Card, CardSkeleton, OptionRow, SectionHeader } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Sheet } from '@/components/Sheet';
import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { dayBucket, formatPaise } from '@/lib/money';
import { AdBanner, AD_PLACEMENTS } from '@/features/ads';

const FALLBACK: Record<string, string> = {
  group_created: 'created the group',
  member_joined: 'joined the group',
  member_left: 'left the group',
  member_removed: 'removed a member',
  invite_regenerated: 'regenerated the group invite',
  payday_updated: 'updated the payday',
  expense_created: 'added an expense',
  expense_updated: 'updated an expense',
  expense_deleted: 'deleted an expense',
  settlement_created: 'recorded a payment',
  settlement_approved: 'confirmed a payment',
  settlement_rejected: 'could not confirm a payment',
  settlement_cancelled: 'cancelled a settlement',
};

export const activityTypeLabel = (type: string): string => {
  const base = FALLBACK[type] ?? type.replace(/_/g, ' ');
  return base.charAt(0).toUpperCase() + base.slice(1);
};

const iconForActivity = (type: string): IconName => {
  if (type.startsWith('expense')) return 'expense';
  if (type.startsWith('settlement')) return 'settlement';
  if (type.includes('member') || type.includes('group')) return 'group';
  return 'activity';
};

const describe = (entry: Activity): string => {
  const legacy = entry.metadata?.legacyAction;
  if (typeof legacy === 'string' && legacy.trim()) return legacy.trim();

  const title = entry.metadata?.title;
  if (typeof title === 'string' && title.trim()) {
    if (entry.type === 'expense_created') return 'added "' + title + '"';
    if (entry.type === 'expense_updated') return 'updated "' + title + '"';
    if (entry.type === 'expense_deleted') return 'deleted "' + title + '"';
  }

  return FALLBACK[entry.type] ?? entry.type.replace(/_/g, ' ');
};

const amountOf = (entry: Activity): number | null => {
  for (const key of ['amountPaise', 'amount_paise', 'sharePaise']) {
    const value = entry.metadata?.[key];
    if (typeof value === 'number' && Number.isInteger(value) && value !== 0) return value;
  }
  return null;
};

const destinationFor = (entry: Activity, groupId: string): string | null => {
  const base = '/group/' + groupId;

  if (entry.entityType === 'expense' && entry.entityId) {
    return entry.type === 'expense_deleted' ? null : base + '/expense/' + entry.entityId;
  }
  if (entry.entityType === 'settlement' && entry.entityId) {
    return base + '/settlement/' + entry.entityId;
  }
  if (entry.entityType === 'user' && entry.entityId) {
    return base + '/person/' + entry.entityId;
  }
  return null;
};

export function ActivityRow({ entry, groupId }: { entry: Activity; groupId: string }) {
  const { colors } = useTheme();
  const router = useRouter();

  const destination = destinationFor(entry, groupId);
  const amount = amountOf(entry);
  const who = entry.isMe ? 'You' : entry.actor.fullName;
  const sentence = who + ' ' + describe(entry);
  const icon = iconForActivity(entry.type);

  return (
    <Card
      onPress={destination ? () => router.push(destination as never) : undefined}
      accessibilityLabel={sentence + (amount ? ', ' + formatPaise(amount, { compact: true }) : '')}
    >
      <View style={styles.row}>
        <View style={[styles.iconBadge, { backgroundColor: colors.subtle }]}>
          <Icon name={icon} size={18} tone="primary" />
        </View>
        <View style={styles.rowBody}>
          <Text style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '600' }} numberOfLines={2}>
            {sentence}
          </Text>
          <Text style={{ color: colors.muted, fontSize: typography.caption }}>
            {new Date(entry.createdAt).toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
        </View>
        {amount ? (
          <Text style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700' }}>
            {formatPaise(amount, { compact: true })}
          </Text>
        ) : null}
        {destination ? <Icon name="forward" size={14} tone="muted" /> : null}
      </View>
    </Card>
  );
}

const PAGE = 30;

export function ActivitySection() {
  const { colors } = useTheme();
  const { groupId, detail, revision } = useGroup();

  const [filters, setFilters] = useState<ActivityFilters>({});
  const [limit, setLimit] = useState(PAGE);
  const [sheet, setSheet] = useState<'type' | 'person' | null>(null);

  const key = JSON.stringify(filters);

  const request = useRequest<ActivityListPayload>(
    useCallback(
      (signal: AbortSignal) => groupsApi.activities(groupId, { ...filters, limit }, signal),
      [groupId, key, limit],
    ),
    [groupId, key, limit, revision],
  );

  const types = useRequest(
    useCallback((signal: AbortSignal) => groupsApi.activityTypes(groupId, signal), [groupId]),
    [groupId],
  );

  const entries = request.data?.activities ?? [];
  const hasMore = request.data?.pagination.hasMore ?? false;

  const days = useMemo(() => {
    const out: { label: string; rows: Activity[] }[] = [];
    for (const entry of entries) {
      const label = dayBucket(entry.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(entry);
      else out.push({ label, rows: [entry] });
    }
    return out;
  }, [entries]);

  const activeFilters = [
    filters.type ? activityTypeLabel(filters.type) : null,
    filters.actorId ? detail?.members.find((m) => m.id === filters.actorId)?.fullName ?? 'One person' : null,
  ].filter(Boolean);

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <PrimaryButton
          label={filters.type ? activityTypeLabel(filters.type) : 'All Activity'}
          icon="filter"
          variant="secondary"
          onPress={() => setSheet('type')}
          style={{ flex: 1 }}
        />
        <PrimaryButton
          label={
            filters.actorId
              ? (detail?.members.find((m) => m.id === filters.actorId)?.fullName ?? 'Person')
              : 'All Members'
          }
          icon="person"
          variant="secondary"
          onPress={() => setSheet('person')}
          style={{ flex: 1 }}
        />
        {activeFilters.length > 0 ? (
          <PrimaryButton
            label="Clear"
            variant="secondary"
            onPress={() => {
              setFilters({});
              setLimit(PAGE);
            }}
          />
        ) : null}
      </View>

      {request.loading && !request.data ? (
        <CardSkeleton rows={5} />
      ) : request.error && !request.data ? (
        <ErrorState error={request.error} onRetry={() => void request.refresh()} />
      ) : entries.length === 0 ? (
        <EmptyState
          title="No activity recorded"
          message={
            activeFilters.length > 0
              ? 'No activity matches your active filters.'
              : 'Expenses, settlements, and group changes will appear here.'
          }
          icon="activity"
          {...(activeFilters.length > 0
            ? { action: { label: 'Clear filters', onPress: () => setFilters({}), variant: 'secondary' } }
            : {})}
        />
      ) : (
        <View style={styles.list}>
          {days.map((day) => (
            <View key={day.label} style={styles.day}>
              <SectionHeader title={day.label} />
              {day.rows.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} groupId={groupId} />
              ))}
            </View>
          ))}

          {hasMore ? (
            <PrimaryButton
              label={request.refreshing ? 'Loading…' : 'Load more'}
              variant="secondary"
              loading={request.refreshing}
              onPress={() => setLimit((value) => value + PAGE)}
              style={{ marginTop: spacing.sm }}
            />
          ) : (
            <>
              <Text style={[styles.end, { color: colors.muted }]}>
                {entries.length === 1 ? '1 activity recorded' : `${entries.length} activities recorded`}
              </Text>
              <AdBanner placement={AD_PLACEMENTS.activity} />
            </>
          )}
        </View>
      )}

      <Sheet visible={sheet === 'type'} onClose={() => setSheet(null)} title="Filter Activity">
        <OptionRow
          label="All activity"
          selected={!filters.type}
          onPress={() => {
            setFilters((f) => {
              const { type, ...rest } = f;
              void type;
              return rest;
            });
            setLimit(PAGE);
            setSheet(null);
          }}
        />
        {(types.data?.types ?? []).map((type) => (
          <OptionRow
            key={type}
            label={activityTypeLabel(type)}
            selected={filters.type === type}
            onPress={() => {
              setFilters((f) => ({ ...f, type }));
              setLimit(PAGE);
              setSheet(null);
            }}
          />
        ))}
      </Sheet>

      <Sheet visible={sheet === 'person'} onClose={() => setSheet(null)} title="Filter by Member">
        <OptionRow
          label="Anyone"
          selected={!filters.actorId}
          onPress={() => {
            setFilters((f) => {
              const { actorId, ...rest } = f;
              void actorId;
              return rest;
            });
            setLimit(PAGE);
            setSheet(null);
          }}
        />
        {(detail?.members ?? []).map((member) => (
          <OptionRow
            key={member.id}
            label={member.fullName}
            selected={filters.actorId === member.id}
            onPress={() => {
              setFilters((f) => ({ ...f, actorId: member.id }));
              setLimit(PAGE);
              setSheet(null);
            }}
          />
        ))}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.base, paddingBottom: spacing.lg },
  filterBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
  },
  list: { paddingHorizontal: spacing.base, gap: spacing.base },
  day: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  end: { fontSize: typography.caption, textAlign: 'center', paddingVertical: spacing.md },
});
