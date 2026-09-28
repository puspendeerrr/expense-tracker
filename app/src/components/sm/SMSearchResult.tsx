import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { SMAmount } from './SMAmount';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

export type SMSearchResultProps = {
  /** A face or an icon well — whatever identifies this kind of result. */
  leading: ReactNode;
  title: string;
  subtitle?: string;
  /** Already formatted, and only when the result carries an amount. */
  amount?: string;
  /** Something small under the amount, such as a status pill. */
  trailing?: ReactNode;
  /** Spoken before the title: "Expense", "Group". */
  kindLabel: string;
  onPress: () => void;
};

/**
 * One search result.
 *
 * A single row shape for every kind of result, so the list reads as one list; the kind is
 * carried by the leading element and the section it sits in, and spoken first to a screen
 * reader. Only what the search response contains is shown — nothing is looked up or
 * worked out to fill a subtitle.
 *
 * Tapping opens the real screen for that record, which fetches it afresh and checks access
 * itself. A result is a pointer, not a copy.
 */
export function SMSearchResult({
  leading,
  title,
  subtitle,
  amount,
  trailing,
  kindLabel,
  onPress,
}: SMSearchResultProps) {
  const { colors, dark } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={kindLabel + '. ' + title + (subtitle ? '. ' + subtitle : '') + (amount ? '. ' + amount : '')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? (dark ? colors.surfaceElevated : colors.subtle) : 'transparent' },
      ]}
    >
      {leading}

      <View style={styles.body}>
        <Text numberOfLines={2} style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} style={[styles.subtitle, { color: colors.muted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {amount || trailing ? (
        <View style={styles.end}>
          {amount ? <SMAmount value={amount} size="compact" /> : null}
          {trailing}
        </View>
      ) : null}

      <Icon name="forward" size={13} tone="muted" />
    </Pressable>
  );
}

/** The icon well used where a result has no face. */
export function SMSearchIcon({ name }: { name: React.ComponentProps<typeof Icon>['name'] }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.well, { backgroundColor: colors.primarySubtle ?? colors.subtle }]}>
      <Icon name={name} size={17} tone="primary" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    minHeight: 60,
  },
  well: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  title: { fontSize: typography.bodySm, fontWeight: '700', lineHeight: 20 },
  subtitle: { fontSize: typography.caption, lineHeight: 18 },
  end: { alignItems: 'flex-end', gap: 4, maxWidth: '38%' },
});
