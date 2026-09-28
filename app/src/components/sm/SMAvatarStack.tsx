import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';

export type SMAvatarStackPerson = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

export type SMAvatarStackProps = {
  people: SMAvatarStackPerson[];
  /** How many faces before the overflow chip. */
  max?: number;
  size?: number;
  onPress?: () => void;
  /** Total count when it is larger than `people` — the server's number, not a guess. */
  totalCount?: number;
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || '?';

/**
 * Overlapping faces, with an overflow chip.
 *
 * `totalCount` exists so the "+4" is the server's number rather than arithmetic on
 * whatever subset of members happened to be fetched. If a caller passes four people out of
 * twelve, the chip should say +8, and only the backend knows that — this component will
 * not infer it.
 *
 * Faces overlap by a third of their width, which reads as a group rather than a row. The
 * whole stack is a single button with one label, because twelve individually focusable
 * avatars is a miserable screen-reader experience for what is really one control.
 */
export function SMAvatarStack({
  people,
  max = 4,
  size = 32,
  onPress,
  totalCount,
}: SMAvatarStackProps) {
  const { colors, dark } = useTheme();

  const shown = people.slice(0, max);
  const total = totalCount ?? people.length;
  const overflow = Math.max(0, total - shown.length);

  const ring = { width: size, height: size, borderRadius: size / 2 };
  const overlap = -Math.round(size / 3);

  const content = (
    <View style={styles.stack}>
      {shown.map((person, index) => (
        <View
          key={person.id}
          style={[
            ring,
            styles.ring,
            {
              borderColor: colors.background,
              backgroundColor: colors.subtle,
              marginLeft: index === 0 ? 0 : overlap,
              // Earlier faces sit on top, so the stack reads left-to-right.
              zIndex: shown.length - index,
            },
          ]}
        >
          {person.avatarUrl ? (
            <Image
              source={{ uri: person.avatarUrl }}
              style={ring}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[ring, styles.fallback, { backgroundColor: colors.primarySubtle ?? colors.subtle }]}>
              <Text style={[styles.initials, { color: colors.primary, fontSize: size * 0.34 }]}>
                {initials(person.name)}
              </Text>
            </View>
          )}
        </View>
      ))}

      {overflow > 0 ? (
        <View
          style={[
            ring,
            styles.ring,
            styles.fallback,
            {
              borderColor: colors.background,
              backgroundColor: dark ? colors.surfaceElevated ?? colors.surface : colors.subtle,
              marginLeft: overlap,
            },
          ]}
        >
          <Text style={[styles.initials, { color: colors.muted, fontSize: size * 0.32 }]}>
            {'+' + overflow}
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        total === 1 ? '1 member. View members.' : total + ' members. View members.'
      }
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { flexDirection: 'row', alignItems: 'center' },
  ring: { borderWidth: 2, overflow: 'hidden' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontWeight: '800' },
});

/** A titled row with an optional trailing action. Used above every list section. */
export function SMSectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={sectionStyles.row}>
      <Text accessibilityRole="header" style={[sectionStyles.title, { color: colors.text }]}>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={[sectionStyles.action, { color: colors.primary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  title: { fontSize: typography.bodySm, fontWeight: '800', letterSpacing: -0.1 },
  action: { fontSize: typography.caption, fontWeight: '700' },
});
