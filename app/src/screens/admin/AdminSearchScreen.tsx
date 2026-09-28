import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { admin } from '@/api/endpoints';
import type { AdminSearchResults } from '@/api/types';
import {
  SMBadge,
  SMEmptyState,
  SMErrorState,
  SMRowSkeleton,
  SMScreenHeader,
  SMSearchInput,
  SMSettingsGroup,
  SMSettingsRow,
} from '@/components/sm';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { formatPaise } from '@/lib/money';

const DEBOUNCE_MS = 300;

/**
 * One box that finds users, groups and expenses anywhere on the platform. The server
 * does the matching; a newer query always wins over a slower, older reply.
 */
export default function AdminSearchScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<AdminSearchResults | null>(null);
  const [error, setError] = useState<unknown>(undefined);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const sequence = useRef(0);

  useEffect(() => {
    const text = q.trim();
    const id = ++sequence.current;
    if (!text) {
      setResults(null);
      setError(undefined);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      admin
        .search(text.slice(0, 100), controller.signal)
        .then((found) => {
          if (id !== sequence.current) return;
          setResults(found);
          setError(undefined);
        })
        .catch((caught: unknown) => {
          if (id !== sequence.current || controller.signal.aborted) return;
          setError(caught);
        })
        .finally(() => {
          if (id === sequence.current) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, attempt]);

  const back = (): void => (router.canGoBack() ? router.back() : router.replace('/admin' as never));
  const empty =
    results && results.users.length === 0 && results.groups.length === 0 && results.expenses.length === 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <SMScreenHeader title="Search" subtitle="Admin console" onBack={back} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <SMSearchInput
          value={q}
          onChangeText={setQ}
          onClear={() => setQ('')}
          placeholder="Users, groups or expenses"
          autoFocus
        />

        {loading && !results ? (
          <SMRowSkeleton rows={4} />
        ) : error ? (
          <SMErrorState error={error} onRetry={() => setAttempt((n) => n + 1)} />
        ) : empty ? (
          <SMEmptyState icon="search" title="No matches" description={'Nothing matches “' + q.trim() + '”.'} />
        ) : results ? (
          <>
            {results.users.length > 0 ? (
              <SMSettingsGroup title="Users">
                {results.users.map((user) => (
                  <SMSettingsRow
                    key={user.id}
                    icon="user"
                    title={user.fullName}
                    subtitle={user.email}
                    trailing={user.status === 'disabled' ? <SMBadge label="Disabled" tone="danger" /> : undefined}
                    onPress={() =>
                      router.push(('/admin/users?q=' + encodeURIComponent(user.email)) as never)
                    }
                  />
                ))}
              </SMSettingsGroup>
            ) : null}
            {results.groups.length > 0 ? (
              <SMSettingsGroup title="Groups">
                {results.groups.map((group) => (
                  <SMSettingsRow
                    key={group.id}
                    icon="group"
                    title={group.name}
                    trailing={group.status === 'disabled' ? <SMBadge label="Disabled" tone="danger" /> : undefined}
                    onPress={() => router.push(('/admin/group/' + group.id) as never)}
                  />
                ))}
              </SMSettingsGroup>
            ) : null}
            {results.expenses.length > 0 ? (
              <SMSettingsGroup title="Expenses">
                {results.expenses.map((expense) => (
                  <SMSettingsRow
                    key={expense.id}
                    icon="expense"
                    title={expense.title}
                    value={formatPaise(expense.amountPaise)}
                    onPress={() => router.push(('/admin/group/' + expense.groupId) as never)}
                  />
                ))}
              </SMSettingsGroup>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: spacing.base, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
});
