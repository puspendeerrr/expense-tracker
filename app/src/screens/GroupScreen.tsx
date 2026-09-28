import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGroup } from '@/features/group/GroupContext';
import { canEditGroup } from '@/features/group/permissions';
import { groups as groupsApi } from '@/api/endpoints';
import { describeError } from '@/api/errors';
import { GROUP_SECTIONS, type GroupSection } from '@/features/group/sections';
import { useSectionSwipe } from '@/features/group/useSectionSwipe';
import { Overview } from '@/features/group/sections/Overview';
import { ExpensesSection } from '@/features/group/sections/Expenses';
import { BalancesSection } from '@/features/group/sections/Balances';
import { SettlementsSection } from '@/features/group/sections/Settlements';
import { MembersSection } from '@/features/group/sections/Members';
import { ActivitySection } from '@/features/group/sections/Activity';
import { Icon, type IconName } from '@/components/Icon';
import {
  SMActionSheet,
  SMAvatarStack,
  SMButton,
  SMConfirmSheet,
  SMEmptyState,
  SMErrorState,
  SMGroupDetailSkeleton,
  SMGroupHero,
  SMSectionHeader,
  SMSegmentedNav,
  type SMAction,
  type SMSegmentOption,
} from '@/components/sm';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, spacing, typography } from '@/theme/tokens';
import { formatPaise } from '@/lib/money';
import { useAiScreenContext } from '@/ai/useAiScreenContext';

/**
 * One group: who it is, what it costs, and the one thing you came to do.
 *
 * WHY THE PRIMARY ACTION IS INLINE RATHER THAN FLOATING
 * Adding an expense is the reason people open a group, so it gets a full-width primary
 * button directly under the identity — above the fold on a 360dp phone, and the first
 * thing a thumb reaches. It is deliberately NOT a floating button: the assistant already
 * owns the bottom-right corner, and a second floating control would either fight it for
 * that space or hover over the expense rows underneath. The Expenses section carries its
 * own Add Expense, so the action stays reachable after the hero has scrolled away.
 *
 * SECTION NAVIGATION SCROLLS WITH THE CONTENT. Pinning it under the header would mean the
 * group's identity scrolls away behind a permanent tab strip, which reads as a website
 * with a sticky nav rather than an app.
 *
 * NOTHING HERE COMPUTES MONEY. Every figure is formatted from what the balance engine
 * already returned through `useGroup`.
 */

const SECTION_ICONS: Record<GroupSection, IconName> = {
  overview: 'pie-chart',
  expenses: 'expense',
  balances: 'balance',
  settlements: 'settlement',
  members: 'users',
  activity: 'activity',
};

export default function GroupScreen() {
  const { colors, dark } = useTheme();
  const { groupId, access, detail, live, refreshing, refresh, error } = useGroup();
  const router = useRouter();

  const [section, setSection] = useState<GroupSection>('overview');
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const inFlight = useRef(false);
  /** Fades the body on section change, so switching reads as a change of place. */
  const bodyFade = useRef(new Animated.Value(1)).current;

  const group = detail?.group;
  const editable = canEditGroup(group);
  // Words the assistant's suggestions with this group's name.
  useAiScreenContext('group', group?.name);
  const members = detail?.members ?? [];

  const owe = live?.balances.youNeedToPayTotal.paise ?? 0;
  const owed = live?.balances.youWillReceiveTotal.paise ?? 0;
  const entangled = owe > 0 || owed > 0;

  const leave = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  };

  const { width } = useWindowDimensions();
  const sectionIndex = GROUP_SECTIONS.findIndex((entry) => entry.value === section);

  const fadeIn = (): void => {
    bodyFade.setValue(0);
    Animated.timing(bodyFade, {
      toValue: 1,
      duration: motion.duration.normal,
      useNativeDriver: true,
    }).start();
  };

  /*
   * Swiping and tapping land on the same state, so the tab strip's indicator follows either
   * way. A swipe has already slid the old content out; this only has to show the new one.
   */
  const swipe = useSectionSwipe({
    index: sectionIndex,
    count: GROUP_SECTIONS.length,
    width,
    onSwipeTo: (next) => {
      const target = GROUP_SECTIONS[next];
      if (target) setSection(target.value);
    },
  });

  const changeSection = (next: GroupSection): void => {
    if (next === section) return;
    const to = GROUP_SECTIONS.findIndex((entry) => entry.value === next);
    setSection(next);
    fadeIn();
    // A tapped tab slides in from the side it sits on, so taps and swipes feel alike.
    swipe.enterFrom(to > sectionIndex ? 1 : -1);
  };

  const go = (path: string): void => router.push(path as never);

  const segments = useMemo<SMSegmentOption<GroupSection>[]>(
    () =>
      GROUP_SECTIONS.map((entry) => ({
        value: entry.value,
        label: entry.label,
        icon: SECTION_ICONS[entry.value],
        attention: entry.value === 'settlements' && (live?.attention.totalActionable ?? 0) > 0,
      })),
    [live?.attention.totalActionable],
  );

  const actions = useMemo<SMAction[]>(() => {
    const list: SMAction[] = [
      {
        id: 'invite',
        label: 'Invite members',
        description: 'Share the group code',
        icon: 'userPlus',
        onPress: () => go('/group/' + groupId + '/settings'),
      },
      {
        id: 'members',
        label: 'Manage members',
        description: members.length + (members.length === 1 ? ' person' : ' people'),
        icon: 'users',
        onPress: () => go('/group/' + groupId + '/members'),
      },
      /*
       * Worded by role. A member opening this sees information and the invite code, not
       * settings they cannot change, so it is not offered to them as "settings".
       */
      editable
        ? {
            id: 'settings',
            label: 'Edit group',
            description: 'Name, photo, cover and invite code',
            icon: 'edit',
            onPress: () => go('/group/' + groupId + '/settings'),
          }
        : {
            id: 'settings',
            label: 'Group info',
            description: 'Details and invite code',
            icon: 'info',
            onPress: () => go('/group/' + groupId + '/settings'),
          },
      {
        id: 'leave',
        label: 'Leave group',
        icon: 'signOut',
        destructive: true,
        onPress: () => { setLeaveError(null); setConfirmLeave(true); },
      },
    ];
    return list;
  }, [groupId, members.length, editable]);

  const doLeave = async (): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLeaving(true);
    setLeaveError(null);
    try {
      await groupsApi.leave(groupId);
      setConfirmLeave(false);
      router.replace('/home');
    } catch (caught: unknown) {
      // The server owns this rule; its sentence is the one worth showing, and it stays in
      // the sheet that asked the question rather than becoming a system alert.
      setLeaveError(describeError(caught).message);
    } finally {
      inFlight.current = false;
      setLeaving(false);
    }
  };

  /* ---- The ways a group can be unavailable ---- */

  if (access === 'denied' || access === 'missing') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <Header title="Group" onBack={leave} />
        <SMEmptyState
          icon={access === 'denied' ? 'shield' : 'alertCircle'}
          title={access === 'denied' ? 'You no longer have access' : 'Group not found'}
          description={
            access === 'denied'
              ? 'You were removed from this group, or it has been disabled. Ask someone in it to invite you back.'
              : 'This group has been deleted, or the link points to one that no longer exists.'
          }
          primaryAction={{ label: 'Back to your groups', onPress: leave }}
        />
      </SafeAreaView>
    );
  }

  if (access === 'error') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <Header title="Group" onBack={leave} />
        <SMErrorState error={error} onRetry={() => void refresh()} />
      </SafeAreaView>
    );
  }

  if (access === 'loading' && !detail) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <Header title="Loading" onBack={leave} />
        <SMGroupDetailSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        title={group?.name ?? 'Group'}
        onBack={leave}
        onMore={() => setActionsOpen(true)}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
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
        <SMGroupHero
          name={group?.name ?? ''}
          avatarUrl={group?.avatarUrl}
          coverUrl={group?.coverUrl}
          description={group?.description}
          memberCount={group?.memberCount ?? members.length}
          currency={group?.currency}
          role={group?.role}
          onPressMembers={() => go('/group/' + groupId + '/members')}
          // Creator only. For everyone else the prop is absent and nothing is drawn.
          {...(editable ? { onEditAppearance: () => go('/group/' + groupId + '/settings') } : {})}
        />

        <View style={styles.actionsBlock}>
          <SMButton
            label="Add expense"
            icon="add"
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => go('/group/' + groupId + '/expense/new')}
            accessibilityHint="Record a new shared expense in this group"
          />

          <View style={styles.quickRow}>
            <QuickAction
              icon="settlement"
              label="Settle up"
              onPress={() => go('/group/' + groupId + '/settle')}
            />
            <QuickAction
              icon="balance"
              label="Balances"
              onPress={() => changeSection('balances')}
            />
            <QuickAction
              icon="userPlus"
              label="Invite"
              onPress={() => go('/group/' + groupId + '/settings')}
            />
          </View>
        </View>

        {/* ---- Where you stand, straight from the engine ---- */}

        {live ? (
          <View style={styles.standing}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={'You owe ' + formatPaise(owe, { compact: true }) + '. View balances.'}
              onPress={() => changeSection('balances')}
              style={({ pressed }) => [
                styles.standingTile,
                {
                  backgroundColor: colors.surface,
                  borderColor: dark ? colors.borderStrong : colors.border,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Text style={[styles.standingLabel, { color: colors.muted }]}>You owe</Text>
              <Text style={[styles.standingValue, { color: owe > 0 ? colors.destructive : colors.muted }]}>
                {formatPaise(owe, { compact: true })}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={'You are owed ' + formatPaise(owed, { compact: true }) + '. View balances.'}
              onPress={() => changeSection('balances')}
              style={({ pressed }) => [
                styles.standingTile,
                {
                  backgroundColor: colors.surface,
                  borderColor: dark ? colors.borderStrong : colors.border,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Text style={[styles.standingLabel, { color: colors.muted }]}>You are owed</Text>
              <Text style={[styles.standingValue, { color: owed > 0 ? colors.success : colors.muted }]}>
                {formatPaise(owed, { compact: true })}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* ---- Members preview ---- */}

        {members.length > 0 ? (
          <View style={styles.membersBlock}>
            <SMSectionHeader
              title="Members"
              actionLabel="View all"
              onAction={() => go('/group/' + groupId + '/members')}
            />
            <SMAvatarStack
              people={members.map((member) => ({ id: member.id, name: member.fullName }))}
              totalCount={group?.memberCount ?? members.length}
              onPress={() => go('/group/' + groupId + '/members')}
            />
          </View>
        ) : null}

        <SMSegmentedNav
          options={segments}
          value={section}
          onChange={changeSection}
          style={styles.nav}
        />

        <Animated.View
          {...swipe.panHandlers}
          style={{ opacity: bodyFade, transform: [{ translateX: swipe.translateX }] }}
        >
          {section === 'overview' ? <Overview onNavigate={changeSection} /> : null}
          {section === 'expenses' ? <ExpensesSection /> : null}
          {section === 'balances' ? <BalancesSection /> : null}
          {section === 'settlements' ? <SettlementsSection /> : null}
          {section === 'members' ? <MembersSection /> : null}
          {section === 'activity' ? <ActivitySection /> : null}
        </Animated.View>
      </ScrollView>

      <SMActionSheet
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title={group?.name ?? 'Group'}
        subtitle="Group actions"
        actions={actions}
      />

      <SMConfirmSheet
        visible={confirmLeave}
        onCancel={() => { setConfirmLeave(false); setLeaveError(null); }}
        errorMessage={leaveError}
        onConfirm={() => void doLeave()}
        destructive
        loading={leaving}
        icon="signOut"
        title={'Leave ' + (group?.name ?? 'this group') + '?'}
        description="You will no longer be able to see this group's expenses or balances. Someone in the group can invite you back."
        detail={
          entangled
            ? 'You still have money outstanding here' +
              (owe > 0 ? ' — you owe ' + formatPaise(owe, { compact: true }) : '') +
              (owed > 0
                ? (owe > 0 ? ', and ' : ' — ') + formatPaise(owed, { compact: true }) + ' is owed to you'
                : '') +
              '. The server will refuse to let you leave until that is settled.'
            : undefined
        }
        cancelLabel="Stay in the group"
        confirmLabel="Leave group"
      />
    </SafeAreaView>
  );
}

/**
 * The screen's own compact header.
 *
 * Not `SMNavbar`: that one carries the drawer, the notification bell and the profile
 * badge, which belong to a top-level destination. This is a pushed screen, so it needs a
 * back affordance and an overflow — putting a hamburger here would offer two competing
 * ways out.
 */
function Header({
  title,
  onBack,
  onMore,
}: {
  title: string;
  onBack: () => void;
  onMore?: () => void;
}) {
  const { colors, dark } = useTheme();
  return (
    <View style={[styles.header, { borderBottomColor: dark ? colors.borderStrong : colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        hitSlop={10}
        style={({ pressed }) => [
          styles.headerButton,
          {
            backgroundColor: dark ? colors.surfaceElevated ?? colors.surface : colors.surface,
            borderColor: dark ? colors.borderStrong : colors.border,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <Icon name="back" size={20} />
      </Pressable>

      <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.text }]}>
        {title}
      </Text>

      {onMore ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Group actions"
          onPress={onMore}
          hitSlop={10}
          style={({ pressed }) => [
            styles.headerButton,
            {
              backgroundColor: dark ? colors.surfaceElevated ?? colors.surface : colors.surface,
              borderColor: dark ? colors.borderStrong : colors.border,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Icon name="more" size={20} />
        </Pressable>
      ) : (
        <View style={styles.headerButton} />
      )}
    </View>
  );
}

/** A compact secondary action. Deliberately quieter than Add expense. */
function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const { colors, dark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const press = (to: number): void => {
    Animated.timing(scale, { toValue: to, duration: motion.duration.fast, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={[styles.quickWrap, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        onPressIn={() => press(motion.scale.pressed)}
        onPressOut={() => press(1)}
        style={({ pressed }) => [
          styles.quick,
          {
            backgroundColor: colors.surface,
            borderColor: dark ? colors.borderStrong : colors.border,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <Icon name={icon} size={17} tone="primary" />
        <Text numberOfLines={1} style={[styles.quickLabel, { color: colors.text }]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm + 2,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.bodySm,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  scroll: { paddingBottom: spacing.hero * 2 },
  actionsBlock: { paddingHorizontal: spacing.base, paddingTop: spacing.lg, gap: spacing.md },
  quickRow: { flexDirection: 'row', gap: spacing.sm },
  quickWrap: { flex: 1 },
  quick: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  quickLabel: { fontSize: typography.caption, fontWeight: '600' },
  standing: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  standingTile: {
    flex: 1,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    gap: spacing.xxs,
    minHeight: 68,
    justifyContent: 'center',
  },
  standingLabel: { fontSize: typography.caption, fontWeight: '500' },
  standingValue: { fontSize: typography.titleSm, fontWeight: '800', letterSpacing: -0.4 },
  membersBlock: { paddingHorizontal: spacing.base, paddingTop: spacing.lg, gap: spacing.sm },
  nav: { marginTop: spacing.lg },
});
