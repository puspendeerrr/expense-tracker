import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/**
 * The Group Detail loading state.
 *
 * Shaped like the screen it stands in for — cover band, avatar, name, metadata, the
 * primary action, then expense rows — so when the real content arrives nothing jumps. A
 * centred spinner tells you to wait; this tells you what you are waiting for, and the
 * layout is already settled when it resolves.
 *
 * One shared opacity drives every block, so the whole screen breathes together instead of
 * shimmering out of phase. It is a slow pulse rather than a travelling gradient: a
 * shimmer sweeping across eight blocks is more motion than a loading state deserves.
 */
export function SMGroupDetailSkeleton() {
  const { colors, dark } = useTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const block = dark ? colors.surface : colors.subtle;
  const Block = ({ style }: { style: object }) => (
    <Animated.View style={[{ backgroundColor: block, opacity: pulse }, style]} />
  );

  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading group"
    >
      <Block style={styles.cover} />

      <View style={styles.identity}>
        <Block style={styles.avatar} />
        <View style={styles.text}>
          <Block style={styles.name} />
          <Block style={styles.meta} />
        </View>
      </View>

      <View style={styles.content}>
        <Block style={styles.cta} />

        <View style={styles.tabs}>
          {[64, 76, 70, 82].map((width, index) => (
            <Block key={index} style={{ width, height: 14, borderRadius: radius.xs }} />
          ))}
        </View>

        <Block style={styles.sectionTitle} />

        {[0, 1, 2].map((index) => (
          <View
            key={index}
            style={[
              styles.expense,
              { borderColor: dark ? colors.borderStrong : colors.border },
            ]}
          >
            <Block style={styles.expenseIcon} />
            <View style={styles.expenseBody}>
              <Block style={styles.expenseTitle} />
              <Block style={styles.expenseMeta} />
            </View>
            <Block style={styles.expenseAmount} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  cover: { height: 104, width: '100%' },
  identity: {
    flexDirection: 'row',
    gap: spacing.base,
    paddingHorizontal: spacing.base,
    marginTop: -32,
  },
  avatar: { width: 70, height: 70, borderRadius: radius.lg + 3 },
  text: { flex: 1, paddingTop: 38, gap: spacing.sm },
  name: { height: 22, width: '62%', borderRadius: radius.xs },
  meta: { height: 13, width: '44%', borderRadius: radius.xs },
  content: { padding: spacing.base, gap: spacing.base, paddingTop: spacing.lg },
  cta: { height: 50, width: '100%', borderRadius: radius.lg },
  tabs: { flexDirection: 'row', gap: spacing.lg, paddingVertical: spacing.sm },
  sectionTitle: { height: 15, width: '38%', borderRadius: radius.xs },
  expense: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    minHeight: 68,
  },
  expenseIcon: { width: 38, height: 38, borderRadius: radius.sm },
  expenseBody: { flex: 1, gap: spacing.sm },
  expenseTitle: { height: 14, width: '58%', borderRadius: radius.xs },
  expenseMeta: { height: 11, width: '40%', borderRadius: radius.xs },
  expenseAmount: { height: 17, width: 62, borderRadius: radius.xs },
});

/**
 * A short run of row-shaped placeholders, for a section that is loading inside an
 * already-drawn screen. Same pulse as [SMGroupDetailSkeleton], so a screen that is partly
 * loaded does not breathe at two different rates.
 */
export function SMRowSkeleton({ rows = 3, bordered = true }: { rows?: number; bordered?: boolean }) {
  const { colors, dark } = useTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const block = dark ? colors.surface : colors.subtle;

  return (
    <View
      style={rowSkeletonStyles.list}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <View
          key={index}
          style={[
            rowSkeletonStyles.row,
            bordered
              ? { borderWidth: 1, borderColor: dark ? colors.borderStrong : colors.border }
              : null,
          ]}
        >
          <Animated.View
            style={[rowSkeletonStyles.icon, { backgroundColor: block, opacity: pulse }]}
          />
          <View style={rowSkeletonStyles.body}>
            <Animated.View
              style={[rowSkeletonStyles.title, { backgroundColor: block, opacity: pulse }]}
            />
            <Animated.View
              style={[rowSkeletonStyles.meta, { backgroundColor: block, opacity: pulse }]}
            />
          </View>
          <Animated.View
            style={[rowSkeletonStyles.amount, { backgroundColor: block, opacity: pulse }]}
          />
        </View>
      ))}
    </View>
  );
}

const rowSkeletonStyles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    minHeight: 68,
  },
  icon: { width: 38, height: 38, borderRadius: radius.sm },
  body: { flex: 1, gap: spacing.sm },
  title: { height: 14, width: '58%', borderRadius: radius.xs },
  meta: { height: 11, width: '40%', borderRadius: radius.xs },
  amount: { height: 17, width: 62, borderRadius: radius.xs },
});
