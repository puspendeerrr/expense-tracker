import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGroup } from '@/features/group/GroupContext';
import { GROUP_SECTIONS, type GroupSection } from '@/features/group/sections';
import { Overview } from '@/features/group/sections/Overview';
import { ExpensesSection } from '@/features/group/sections/Expenses';
import { BalancesSection } from '@/features/group/sections/Balances';
import { SettlementsSection } from '@/features/group/sections/Settlements';
import { MembersSection } from '@/features/group/sections/Members';
import { ActivitySection } from '@/features/group/sections/Activity';
import { Avatar, CardSkeleton, SegmentedControl } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Sheet } from '@/components/Sheet';
import { ThemeToggle } from '@/components/AppHeader';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

export default function GroupScreen() {
  const { colors } = useTheme();
  const { access, detail, refreshing, refresh, error } = useGroup();
  const router = useRouter();

  const [section, setSection] = useState<GroupSection>('overview');
  const [menu, setMenu] = useState(false);

  const group = detail?.group;

  const leave = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  };

  if (access === 'denied' || access === 'missing') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <EmptyState
          title={access === 'denied' ? 'Access denied' : 'Group not found'}
          message={
            access === 'denied'
              ? 'You are not a member of this group or your access was removed.'
              : 'This group could not be found or may have been deleted.'
          }
          icon="group"
          action={{ label: 'Back to your groups', onPress: leave }}
        />
      </SafeAreaView>
    );
  }

  if (access === 'error') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <ErrorState error={error} onRetry={() => void refresh()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Chrome Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to groups"
          onPress={leave}
          hitSlop={12}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Icon name="back" size={18} tone="default" />
        </Pressable>

        <Avatar name={group?.name ?? '?'} uri={group?.avatarUrl} size={38} />

        <View style={styles.titles}>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '800' }}
          >
            {group?.name ?? 'Loading…'}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: typography.caption }}>
            {group?.memberCount === undefined
              ? ''
              : `${group.memberCount} ${group.memberCount === 1 ? 'member' : 'members'}`}
          </Text>
        </View>

        <ThemeToggle />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Group options"
          onPress={() => setMenu(true)}
          hitSlop={10}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Icon name="more" size={18} tone="default" />
        </Pressable>
      </View>

      {/* Modern Segmented Strip */}
      <SegmentedControl options={GROUP_SECTIONS} value={section} onChange={setSection} />

      {/* Body */}
      {access === 'loading' && !detail ? (
        <CardSkeleton rows={5} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              colors={[colors.primary]}
              tintColor={colors.primary}
              progressBackgroundColor={colors.surface}
            />
          }
        >
          {section === 'overview' ? <Overview onNavigate={setSection} /> : null}
          {section === 'expenses' ? <ExpensesSection /> : null}
          {section === 'balances' ? <BalancesSection /> : null}
          {section === 'settlements' ? <SettlementsSection /> : null}
          {section === 'members' ? <MembersSection /> : null}
          {section === 'activity' ? <ActivitySection /> : null}
        </ScrollView>
      )}

      {/* Group Action Sheet */}
      <Sheet visible={menu} onClose={() => setMenu(false)} title={group?.name ?? 'Group Actions'}>
        <View style={styles.menuStack}>
          <PrimaryButton
            label="Add Expense"
            icon="add"
            variant="primary"
            onPress={() => {
              setMenu(false);
              router.push(('/group/' + (group?.id ?? '') + '/expense/new') as never);
            }}
          />
          <PrimaryButton
            label="Settle Up"
            icon="settlement"
            variant="secondary"
            onPress={() => {
              setMenu(false);
              router.push(('/group/' + (group?.id ?? '') + '/settle') as never);
            }}
          />
          <PrimaryButton
            label="Balances"
            icon="balance"
            variant="secondary"
            onPress={() => {
              setMenu(false);
              setSection('balances');
            }}
          />
          <PrimaryButton
            label="Group Settings"
            icon="settings"
            variant="secondary"
            onPress={() => {
              setMenu(false);
              router.push(('/group/' + (group?.id ?? '') + '/settings') as never);
            }}
          />
          {group?.inviteCode ? (
            <View style={[styles.inviteBox, { backgroundColor: colors.subtle, borderColor: colors.border }]}>
              <Icon name="copy" size={16} tone="primary" />
              <Text style={{ color: colors.text, fontSize: typography.caption, fontWeight: '600' }} selectable>
                Invite Code: {group.inviteCode}
              </Text>
            </View>
          ) : null}
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1, gap: 1 },
  body: { paddingBottom: spacing.xxl },
  menuStack: { gap: spacing.sm, paddingVertical: spacing.xs },
  inviteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
});
