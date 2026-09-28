import { useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { SearchResults } from '@/api/types';
import { MIN_QUERY, isEmptyResults, useGlobalSearch } from '@/features/search/useGlobalSearch';
import { activityTypeLabel } from '@/features/group/activityFeed';
import { ledgerDateLabel } from '@/features/group/ledger';
import {
  SMAvatar,
  SMCard,
  SMEmptyState,
  SMErrorState,
  SMRowSkeleton,
  SMScreenHeader,
  SMSearchIcon,
  SMSearchInput,
  SMSearchResult,
  SMSettlementStatus,
} from '@/components/sm';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';
import { formatExpenseDate, formatPaise } from '@/lib/money';

/**
 * Find something you already know is there.
 *
 * Not the AI assistant: this is for "pizza", not "why do I owe Rahul". It calls the real
 * search endpoint, which is scoped on the server to the groups the viewer belongs to, and
 * shows its five kinds of result in their own sections — only the sections that have
 * something in them.
 *
 * Every result opens the record's existing screen, which loads it afresh and enforces
 * access. If the record has since been deleted or the viewer removed from its group, that
 * screen's own "not found" state is what they see.
 */
export default function SearchScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [text, setText] = useState('');
  const { state, retry } = useGlobalSearch(text);

  const back = (): void => (router.canGoBack() ? router.back() : router.replace('/home'));
  const go = (path: string): void => {
    Keyboard.dismiss();
    router.push(path as never);
  };

  const results: SearchResults | null =
    state.kind === 'success' ? state.results : state.kind === 'loading' ? state.previous : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <SMScreenHeader title="Search" onBack={back} />

      <View style={styles.inputWrap}>
        <SMSearchInput
          value={text}
          onChangeText={setText}
          onClear={() => setText('')}
          placeholder="Search groups, expenses, people…"
          accessibilityLabel="Search SplitMoney"
          autoFocus
          onSubmitEditing={retry}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {state.kind === 'idle' ? (
          <SMEmptyState
            icon="search"
            title="Search SplitMoney"
            description="Find groups, expenses, people, payments and activity from the groups you’re in."
          />
        ) : state.kind === 'short' ? (
          <Text style={[styles.hint, { color: colors.muted }]}>
            {'Keep typing — searches start at ' + MIN_QUERY + ' characters.'}
          </Text>
        ) : state.kind === 'error' ? (
          <SMErrorState error={state.error} onRetry={retry} />
        ) : state.kind === 'loading' && !results ? (
          <SMRowSkeleton rows={5} bordered={false} />
        ) : results && isEmptyResults(results) && state.kind === 'success' ? (
          <SMEmptyState
            icon="search"
            title={'No results for “' + state.query + '”'}
            description="Try another spelling, a group’s name, a person’s name or an expense title."
          />
        ) : results ? (
          <View style={[styles.sections, state.kind === 'loading' ? styles.stale : null]}>
            {results.groups.length > 0 ? (
              <Section title="Groups">
                {results.groups.map((group) => (
                  <SMSearchResult
                    key={'g' + group.id}
                    kindLabel="Group"
                    leading={<SMAvatar name={group.name} uri={group.avatarUrl} size={38} />}
                    title={group.name}
                    subtitle={group.memberCount + (group.memberCount === 1 ? ' member' : ' members')}
                    onPress={() => go('/group/' + group.id)}
                  />
                ))}
              </Section>
            ) : null}

            {results.expenses.length > 0 ? (
              <Section title="Expenses">
                {results.expenses.map((expense) => (
                  <SMSearchResult
                    key={'e' + expense.id}
                    kindLabel="Expense"
                    leading={<SMSearchIcon name="expense" />}
                    title={expense.title}
                    subtitle={
                      expense.payerName + ' paid · ' + expense.groupName + ' · ' + formatExpenseDate(expense.expenseDate)
                    }
                    amount={formatPaise(expense.amountPaise, { compact: true })}
                    onPress={() => go('/group/' + expense.groupId + '/expense/' + expense.id)}
                  />
                ))}
              </Section>
            ) : null}

            {results.members.length > 0 ? (
              <Section title="People">
                {results.members.map((member) => (
                  <SMSearchResult
                    key={'m' + member.id + member.groupId}
                    kindLabel="Person"
                    leading={<SMAvatar name={member.fullName} size={38} round />}
                    title={member.fullName}
                    subtitle={'In ' + member.groupName}
                    onPress={() => go('/group/' + member.groupId + '/person/' + member.id)}
                  />
                ))}
              </Section>
            ) : null}

            {results.settlements.length > 0 ? (
              <Section title="Payments">
                {results.settlements.map((settlement) => (
                  <SMSearchResult
                    key={'s' + settlement.id}
                    kindLabel="Payment"
                    leading={<SMSearchIcon name="settlement" />}
                    title={settlement.payerName + ' → ' + (settlement.receiverName ?? 'a former member')}
                    subtitle={settlement.groupName}
                    amount={formatPaise(settlement.amountPaise, { compact: true })}
                    trailing={<SMSettlementStatus status={settlement.status} />}
                    onPress={() => go('/group/' + settlement.groupId + '/settlement/' + settlement.id)}
                  />
                ))}
              </Section>
            ) : null}

            {results.activity.length > 0 ? (
              <Section title="Activity">
                {results.activity.map((entry) => (
                  <SMSearchResult
                    key={'a' + entry.id}
                    kindLabel="Activity"
                    leading={<SMSearchIcon name="activity" />}
                    title={entry.actorName + ' · ' + activityTypeLabel(entry.type)}
                    subtitle={entry.groupName + ' · ' + ledgerDateLabel(entry.createdAt)}
                    onPress={() => go('/group/' + entry.groupId)}
                  />
                ))}
              </Section>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.muted }]}>
        {title}
      </Text>
      <SMCard style={styles.card}>{children}</SMCard>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  inputWrap: { paddingHorizontal: spacing.base, paddingTop: spacing.md },
  body: { padding: spacing.base, gap: spacing.md, paddingBottom: spacing.xxl },
  hint: { fontSize: typography.caption, textAlign: 'center', paddingTop: spacing.lg },
  sections: { gap: spacing.lg },
  // Earlier results stay visible, dimmed, while the next query loads — no flash to blank.
  stale: { opacity: 0.55 },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: typography.xs, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  card: { padding: spacing.xs },
});
