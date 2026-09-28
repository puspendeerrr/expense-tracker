import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useGroup } from '../GroupContext';
import { useAuth } from '@/auth/AuthProvider';
import {
  SMBadge,
  SMCard,
  SMAvatar,
  SMEmptyState,
  SMPersonBalanceRow,
  SMSectionHeader,
} from '@/components/sm';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { formatPaise } from '@/lib/money';

export function BalancesSection() {
  const { colors, dark } = useTheme();
  const { groupId, live, detail } = useGroup();
  const { user } = useAuth();
  const router = useRouter();

  const balances = live?.balances;
  const iOwe = live?.peopleIOwe ?? [];
  const oweMe = live?.peopleWhoOweMe ?? [];

  const settled = (detail?.members ?? []).filter(
    (member) =>
      member.id !== user?.id &&
      !iOwe.some((e) => e.user.id === member.id) &&
      !oweMe.some((e) => e.user.id === member.id),
  );

  const open = (userId: string): void => {
    router.push(('/group/' + groupId + '/person/' + userId) as never);
  };

  if (iOwe.length === 0 && oweMe.length === 0) {
    return (
      <View style={styles.container}>
        <SMEmptyState
          title="All square"
          description="Nobody in this group owes anything right now. Every balance is settled."
          icon="check"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SMCard style={styles.card}>
        <View style={styles.totals}>
          <View style={styles.total}>
            <Text style={{ color: colors.muted, fontSize: typography.caption, fontWeight: '600' }}>
              You owe
            </Text>
            <Text
              style={{
                color: colors.destructive,
                fontSize: typography.title,
                fontWeight: '800',
              }}
            >
              {formatPaise(balances?.youNeedToPayTotal.paise ?? 0, { compact: true })}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.total}>
            <Text style={{ color: colors.muted, fontSize: typography.caption, fontWeight: '600' }}>
              You are owed
            </Text>
            <Text
              style={{
                color: colors.success,
                fontSize: typography.title,
                fontWeight: '800',
              }}
            >
              {formatPaise(balances?.youWillReceiveTotal.paise ?? 0, { compact: true })}
            </Text>
          </View>
        </View>

        <View style={[styles.infoBanner, { backgroundColor: colors.subtle }]}>
          <Icon name="info" size={14} tone="primary" />
          <Text style={{ color: colors.muted, fontSize: typography.xs, lineHeight: 16, flex: 1 }}>
            Debts are directional and pairwise. They are never netted against each other.
          </Text>
        </View>
      </SMCard>

      {iOwe.length > 0 ? (
        <View style={styles.block}>
          <SMSectionHeader title={'You owe (' + iOwe.length + ')'} />
          <View style={styles.rows}>
            {iOwe.map((entry) => (
              <SMPersonBalanceRow
                key={'owe-' + entry.user.id}
                name={entry.user.fullName}
                amount={formatPaise(entry.amountPaise, { compact: true })}
                direction="i_owe"
                onPress={() => open(entry.user.id)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {oweMe.length > 0 ? (
        <View style={styles.block}>
          <SMSectionHeader title={'Owed to you (' + oweMe.length + ')'} />
          <View style={styles.rows}>
            {oweMe.map((entry) => (
              <SMPersonBalanceRow
                key={'owed-' + entry.user.id}
                name={entry.user.fullName}
                amount={formatPaise(entry.amountPaise, { compact: true })}
                direction="they_owe"
                onPress={() => open(entry.user.id)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {settled.length > 0 ? (
        <View style={styles.block}>
          <SMSectionHeader title={'Settled (' + settled.length + ')'} />
          <View style={styles.rows}>
            {settled.map((member) => (
              <Pressable
                key={member.id}
                accessibilityRole="button"
                accessibilityLabel={member.fullName + ', all square'}
                onPress={() => open(member.id)}
                style={({ pressed }) => [
                  styles.settledRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: dark ? colors.borderStrong : colors.border,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <SMAvatar name={member.fullName} size={34} round />
                <Text
                  numberOfLines={1}
                  style={[styles.settledName, { color: colors.text }]}
                >
                  {member.fullName}
                </Text>
                <SMBadge label="Settled" tone="success" icon="check" />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.base, gap: spacing.base },
  block: { gap: spacing.sm },
  totals: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  total: { flex: 1, gap: spacing.xxs },
  divider: { width: 1, height: 44 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  card: { padding: spacing.base },
  rows: { gap: spacing.sm },
  settledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    minHeight: 60,
  },
  settledName: { flex: 1, fontSize: typography.bodySm, fontWeight: '600', letterSpacing: -0.1 },
});
