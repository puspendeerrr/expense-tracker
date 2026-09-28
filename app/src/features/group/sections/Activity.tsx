import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { groups as groupsApi } from '@/api/endpoints';
import type { Activity, ActivityFilters, ActivityListPayload } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useAuth } from '@/auth/AuthProvider';
import { useGroup } from '../GroupContext';
import { groupByDay } from '../ledger';
import {
  ACTIVITY_TYPE_GROUPS,
  activityTypeLabel,
  describeActivityEntry,
} from '../activityFeed';
import {
  SMActivityRow,
  SMAvatar,
  SMButton,
  SMCard,
  SMDateHeader,
  SMEmptyState,
  SMErrorState,
  SMFilterChip,
  SMOptionRow,
  SMRowSkeleton,
  SMSelectField,
  SMSheet,
} from '@/components/sm';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';
import { formatPaise } from '@/lib/money';
import { AdBanner, AD_PLACEMENTS } from '@/features/ads';

const PAGE = 30;

const timeOf = (iso: string): string =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/**
 * One activity entry, bound to the data. Used by this section and by Overview's short
 * "recent activity" list, so an event reads the same in both places.
 *
 * Opening an entry goes to the record's own screen — Expense Detail, Settlement Detail —
 * which decides what the viewer may do there. The feed itself offers no edit, delete,
 * approve or cancel of its own, so it cannot drift from those screens' permissions.
 */
export function ActivityRow({ entry, groupId }: { entry: Activity; groupId: string }) {
  const router = useRouter();
  const { detail } = useGroup();
  const { user } = useAuth();

  // Null for anyone no longer in the group, so they are described generically.
  const nameOf = useCallback(
    (id: string) => detail?.members.find((member) => member.id === id)?.fullName ?? null,
    [detail?.members],
  );

  const view = describeActivityEntry(entry, groupId, nameOf, user?.id);
  const destination = view.destination;

  return (
    <SMActivityRow
      actorName={entry.actor.fullName}
      actorLabel={entry.isMe ? 'You' : entry.actor.fullName || 'Someone'}
      action={view.action}
      icon={view.icon}
      tone={view.tone}
      timeLabel={timeOf(entry.createdAt)}
      {...(view.amountPaise !== null ? { amount: formatPaise(view.amountPaise, { compact: true }) } : {})}
      {...(view.note ? { note: view.note } : {})}
      emphasis={view.emphasis}
      {...(destination ? { onPress: () => router.push(destination as never) } : {})}
    />
  );
}

/**
 * What happened in this group, newest first.
 *
 * FILTERS ARE THE SERVER'S. The activity endpoint filters by one exact event type and by
 * who did it, so those are the two controls. The type list is grouped under headings for
 * reading, but every option is still one exact type, and only types that have actually
 * occurred in this group (the `activities/types` endpoint) are offered.
 *
 * NO DUPLICATES ON REFRESH. A realtime event bumps `revision`, which re-reads the list from
 * offset zero with the same limit and REPLACES it. Nothing is appended by hand, so an event
 * arriving mid-refresh cannot appear twice.
 */
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
  const total = request.data?.pagination.total ?? entries.length;
  const hasMore = request.data?.pagination.hasMore ?? false;

  // Same day grouping as the expense ledger: Today, Yesterday, then real dates.
  const days = useMemo(() => groupByDay(entries, (entry) => entry.createdAt), [entries]);

  const present = new Set(types.data?.types ?? []);
  const typeGroups = ACTIVITY_TYPE_GROUPS.map((group) => ({
    ...group,
    types: group.types.filter((type) => present.size === 0 || present.has(type)),
  })).filter((group) => group.types.length > 0);

  const personName = filters.actorId
    ? detail?.members.find((member) => member.id === filters.actorId)?.fullName ?? 'One person'
    : null;

  const filtered = Boolean(filters.type || filters.actorId);

  const update = (next: ActivityFilters): void => {
    setFilters(next);
    setLimit(PAGE);
  };

  return (
    <View style={styles.container}>
      {/* ---- Filters: what kind, and by whom ---- */}
      <View style={styles.filterRow}>
        <View style={styles.filterCell}>
          <SMSelectField
            label="Type"
            value={filters.type ? activityTypeLabel(filters.type) : 'Everything'}
            icon="filter"
            onPress={() => setSheet('type')}
          />
        </View>
        <View style={styles.filterCell}>
          <SMSelectField
            label="By"
            value={personName ?? 'Anyone'}
            icon="user"
            onPress={() => setSheet('person')}
          />
        </View>
      </View>

      {filtered ? (
        <View style={styles.chips}>
          {filters.type ? (
            <SMFilterChip
              label={activityTypeLabel(filters.type)}
              icon="filter"
              onPress={() => setSheet('type')}
              onRemove={() => update({ ...filters, type: undefined })}
            />
          ) : null}
          {personName ? (
            <SMFilterChip
              label={personName}
              icon="user"
              onPress={() => setSheet('person')}
              onRemove={() => update({ ...filters, actorId: undefined })}
            />
          ) : null}
        </View>
      ) : null}

      {/* ---- The feed ---- */}
      {request.loading && !request.data ? (
        <SMRowSkeleton rows={6} bordered={false} />
      ) : request.error && !request.data ? (
        <SMErrorState error={request.error} onRetry={() => void request.refresh()} />
      ) : entries.length === 0 ? (
        filtered ? (
          <SMEmptyState
            icon="filter"
            title="No activity matches this filter"
            description="There is activity in this group, just none that fits."
            primaryAction={{ label: 'Reset filters', onPress: () => update({}) }}
          />
        ) : (
          <SMEmptyState
            icon="activity"
            title="No activity yet"
            description="Expenses, payments and changes in this group will appear here."
          />
        )
      ) : (
        <View style={styles.feed}>
          {days.map((day) => (
            <View key={day.label} style={styles.day}>
              <SMDateHeader label={day.label} />
              <SMCard style={styles.dayCard}>
                {day.rows.map((entry) => (
                  <ActivityRow key={entry.id} entry={entry} groupId={groupId} />
                ))}
              </SMCard>
            </View>
          ))}

          {hasMore ? (
            <SMButton
              label={request.refreshing ? 'Loading…' : 'Load older activity'}
              variant="secondary"
              loading={request.refreshing}
              onPress={() => setLimit((value) => value + PAGE)}
              style={styles.more}
            />
          ) : (
            <>
              <Text style={[styles.end, { color: colors.muted }]}>
                {filtered
                  ? total === 1 ? '1 matching event' : total + ' matching events'
                  : 'That’s everything since the group began'}
              </Text>
              <AdBanner placement={AD_PLACEMENTS.activity} />
            </>
          )}
        </View>
      )}

      {/* ---- Type sheet: grouped for reading, one exact type per option ---- */}
      <SMSheet visible={sheet === 'type'} onClose={() => setSheet(null)} title="Show activity">
        <SMOptionRow
          label="Everything"
          icon="activity"
          selected={!filters.type}
          onPress={() => {
            update({ ...filters, type: undefined });
            setSheet(null);
          }}
        />
        {typeGroups.map((group) => (
          <View key={group.title} style={styles.sheetGroup}>
            <Text style={[styles.sheetGroupTitle, { color: colors.muted }]}>{group.title}</Text>
            {group.types.map((type) => (
              <SMOptionRow
                key={type}
                label={activityTypeLabel(type)}
                selected={filters.type === type}
                onPress={() => {
                  update({ ...filters, type });
                  setSheet(null);
                }}
              />
            ))}
          </View>
        ))}
      </SMSheet>

      {/* ---- Person sheet ---- */}
      <SMSheet visible={sheet === 'person'} onClose={() => setSheet(null)} title="Activity by">
        <SMOptionRow
          label="Anyone"
          icon="users"
          selected={!filters.actorId}
          onPress={() => {
            update({ ...filters, actorId: undefined });
            setSheet(null);
          }}
        />
        {(detail?.members ?? []).map((member) => (
          <SMOptionRow
            key={member.id}
            label={member.fullName}
            leading={<SMAvatar name={member.fullName} size={30} round />}
            selected={filters.actorId === member.id}
            onPress={() => {
              update({ ...filters, actorId: member.id });
              setSheet(null);
            }}
          />
        ))}
      </SMSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.base, gap: spacing.md },
  filterRow: { flexDirection: 'row', gap: spacing.sm },
  filterCell: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  feed: { gap: spacing.xs },
  day: { gap: spacing.xs },
  dayCard: { paddingVertical: spacing.xs, paddingHorizontal: spacing.xs },
  more: { marginTop: spacing.sm },
  end: { textAlign: 'center', fontSize: typography.caption, paddingVertical: spacing.md },
  sheetGroup: { paddingTop: spacing.md, gap: 2 },
  sheetGroupTitle: {
    fontSize: typography.xs,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
});
