import type { ReactElement, ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  SMButton,
  SMChipFilter,
  SMEmptyState,
  SMErrorState,
  SMRowSkeleton,
  SMScreenHeader,
  SMSearchInput,
  type SMChipFilterOption,
} from '@/components/sm';
import type { IconName } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import type { AdminListState } from './useAdminList';
import { plural } from './format';

type Filter<F extends string> = {
  label: string;
  options: SMChipFilterOption<F>[];
  value: F;
  onChange: (value: F) => void;
};

export type AdminListScreenProps<T, F extends string> = {
  title: string;
  /** What the total counts, singular: "user", "group". */
  noun: string;
  /** When adding an s is wrong: "entries". */
  nounPlural?: string;
  list: AdminListState<T>;
  search: string;
  onSearch: (text: string) => void;
  searchPlaceholder: string;
  filter?: Filter<F>;
  /** A line under the count, e.g. the value of everything listed. */
  summary?: string;
  emptyIcon: IconName;
  keyOf: (row: T) => string;
  renderRow: (row: T) => ReactElement;
};

/**
 * The frame every admin list shares: search, one row of filters, the server's total, and
 * a list that pages in as it is scrolled.
 *
 * Read-only by construction — it renders rows and nothing else. Counts are the server's
 * `total`, never the length of what happens to be loaded.
 */
export function AdminListScreen<T, F extends string>({
  title,
  noun,
  nounPlural = noun + 's',
  list,
  search,
  onSearch,
  searchPlaceholder,
  filter,
  summary,
  emptyIcon,
  keyOf,
  renderRow,
}: AdminListScreenProps<T, F>) {
  const { colors } = useTheme();
  const router = useRouter();
  const back = (): void => (router.canGoBack() ? router.back() : router.replace('/admin' as never));

  const header = (
    <View style={styles.top}>
      <SMSearchInput
        value={search}
        onChangeText={onSearch}
        onClear={() => onSearch('')}
        placeholder={searchPlaceholder}
      />
      {filter ? (
        <SMChipFilter
          accessibilityLabel={filter.label}
          options={filter.options}
          value={filter.value}
          onChange={filter.onChange}
        />
      ) : null}
      {!list.loading && !list.error ? (
        <View>
          <Text style={[styles.count, { color: colors.muted }]}>{plural(list.total, noun, nounPlural)}</Text>
          {summary ? <Text style={[styles.count, { color: colors.muted }]}>{summary}</Text> : null}
        </View>
      ) : null}
    </View>
  );

  let body: ReactNode = null;
  if (list.loading) body = <SMRowSkeleton rows={6} />;
  else if (list.error && list.rows.length === 0) body = <SMErrorState error={list.error} onRetry={() => void list.refresh()} />;
  else if (list.rows.length === 0)
    body = (
      <SMEmptyState
        icon={emptyIcon}
        title={search ? 'No matches' : 'Nothing here yet'}
        description={search ? 'Nothing matches “' + search.trim() + '”.' : 'There are no ' + nounPlural + ' to show here.'}
      />
    );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <SMScreenHeader title={title} subtitle="Admin console" onBack={back} />
      <FlatList
        data={body ? [] : list.rows}
        keyExtractor={keyOf}
        renderItem={({ item }) => renderRow(item)}
        ListHeaderComponent={header}
        ListEmptyComponent={body ? <View style={styles.state}>{body}</View> : null}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={list.refreshing} onRefresh={() => void list.refresh()} tintColor={colors.primary} colors={[colors.primary]} />
        }
        ListFooterComponent={
          list.loadingMore ? (
            <ActivityIndicator style={styles.footer} color={colors.primary} />
          ) : list.error && list.rows.length > 0 ? (
            <View style={styles.footer}>
              <SMButton label="Couldn’t load more — try again" variant="secondary" onPress={() => void list.refresh()} />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

export type AdminRowProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  trailing?: ReactNode;
  badges?: ReactNode;
  onPress?: () => void;
  accessibilityHint?: string;
};

/** One record in an admin list. Tappable only when it leads somewhere. */
export function AdminRow({ title, subtitle, meta, trailing, badges, onPress, accessibilityHint }: AdminRowProps) {
  const { colors, dark } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityHint={accessibilityHint}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.subtle : dark ? colors.surface : colors.surfaceElevated ?? colors.surface,
          borderColor: dark ? colors.borderStrong : colors.border,
        },
      ]}
    >
      <View style={styles.rowMain}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowSub, { color: colors.muted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {badges ? <View style={styles.badges}>{badges}</View> : null}
        {meta ? (
          <Text style={[styles.rowMeta, { color: colors.muted }]} numberOfLines={2}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: spacing.base, paddingBottom: spacing.xxl * 2 },
  top: { gap: spacing.md, marginBottom: spacing.md },
  count: { fontSize: typography.caption, fontWeight: '600' },
  state: { paddingTop: spacing.lg },
  gap: { height: spacing.sm },
  footer: { paddingVertical: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: typography.body, fontWeight: '700' },
  rowSub: { fontSize: typography.caption },
  rowMeta: { fontSize: typography.xs, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  trailing: { alignItems: 'flex-end' },
});
