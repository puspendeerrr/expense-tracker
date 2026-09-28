import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

export type SMNotificationKind = 'expense' | 'payment' | 'member' | 'reminder' | 'security';

export type SMNotificationItemProps = {
  title: string;
  message: string;
  timeLabel: string;
  kind: SMNotificationKind;
  icon: IconName;
  unread: boolean;
  /** Present only when there is somewhere real to go. */
  onPress?: () => void;
};

/**
 * One notification.
 *
 * UNREAD IS SAID THREE WAYS: a tinted surface, a dot, and a heavier title — and in words
 * to a screen reader. None of them is carried by colour alone.
 *
 * The server writes each notification's title and message, and they are shown as written:
 * that wording is the record of what the person was told, and re-deriving it here from the
 * type could say something different. This component only arranges it.
 *
 * Security notifications get a warning-tinted icon, which is the one place priority is
 * shown. Everything else stays calm, so the one that matters stands out.
 */
export function SMNotificationItem({
  title,
  message,
  timeLabel,
  kind,
  icon,
  unread,
  onPress,
}: SMNotificationItemProps) {
  const { colors, dark } = useTheme();

  const well: Record<SMNotificationKind, { bg: string; fg: string }> = {
    expense: { bg: colors.primarySubtle ?? colors.subtle, fg: colors.primary },
    payment: { bg: colors.infoLight, fg: colors.info },
    member: { bg: dark ? colors.surfaceElevated : colors.subtle, fg: colors.text },
    reminder: { bg: colors.warningLight, fg: colors.warning },
    security: { bg: colors.destructiveLight, fg: colors.destructive },
  };
  const tint = well[kind];

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        (unread ? 'Unread. ' : '') + title + '. ' + message + '. ' + timeLabel
      }
      accessibilityHint={onPress ? 'Opens it' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed
            ? dark
              ? colors.surfaceElevated
              : colors.subtle
            : unread
              ? colors.primarySubtle ?? colors.subtle
              : 'transparent',
        },
      ]}
    >
      <View style={[styles.well, { backgroundColor: tint.bg }]}>
        <Icon name={icon} size={17} color={tint.fg} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text, fontWeight: unread ? '800' : '600' }]}>
            {title}
          </Text>
          {unread ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
        </View>
        <Text numberOfLines={3} style={[styles.message, { color: unread ? colors.text : colors.muted }]}>
          {message}
        </Text>
        <Text style={[styles.time, { color: colors.muted }]}>{timeLabel}</Text>
      </View>

      {onPress ? (
        <View style={styles.chevron}>
          <Icon name="forward" size={13} tone="muted" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    minHeight: 64,
  },
  well: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flexShrink: 1, fontSize: typography.bodySm, lineHeight: 20 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  message: { fontSize: typography.caption, lineHeight: 18 },
  time: { fontSize: typography.xs },
  chevron: { paddingTop: 12 },
});
