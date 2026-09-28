import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { SMAvatar } from './SMAvatar';
import { SMAmount } from './SMAmount';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, spacing, typography } from '@/theme/tokens';

export type SMActivityTone = 'expense' | 'payment' | 'member' | 'group' | 'negative';

export type SMActivityRowProps = {
  /** Used for the avatar's initials. */
  actorName: string;
  /** How the actor is written in the sentence — "You" for the viewer. */
  actorLabel: string;
  /** The rest of the sentence: 'added “Dinner”'. */
  action: string;
  icon: IconName;
  tone: SMActivityTone;
  timeLabel: string;
  /** Already formatted, and only when the event recorded one. */
  amount?: string;
  /** One line of recorded context: "Was ₹500", a rejection reason. */
  note?: string;
  /** Events where money moved or was claimed to — drawn with slightly more weight. */
  emphasis?: boolean;
  onPress?: () => void;
};

/**
 * One thing that happened in a group.
 *
 * READS AS A SENTENCE. Who, in the stronger weight, then what they did: "Rahul added
 * “Dinner”". The actor's face identifies them at a glance; the small badge on the face
 * says what KIND of thing happened — added, edited, paid, joined — with its own icon, so
 * the type reads without depending on the badge's tint.
 *
 * DENSE ON PURPOSE. A feed is scanned, not read, so each entry is a compact row rather
 * than a card: the amount sits right-aligned where a column of them can be skimmed, and
 * the time is one quiet line under the sentence. Text wraps rather than truncates, so a
 * long title or a large system font never cuts a sentence in half.
 *
 * Tappable only when there is something real to open; the chevron appears only then.
 */
export function SMActivityRow({
  actorName,
  actorLabel,
  action,
  icon,
  tone,
  timeLabel,
  amount,
  note,
  emphasis = false,
  onPress,
}: SMActivityRowProps) {
  const { colors, dark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const badge: Record<SMActivityTone, { bg: string; fg: string }> = {
    expense: { bg: colors.primary, fg: colors.onPrimary ?? '#FFFFFF' },
    payment: { bg: colors.info, fg: '#FFFFFF' },
    member: { bg: dark ? colors.surfaceElevated : colors.subtle, fg: colors.text },
    group: { bg: dark ? colors.surfaceElevated : colors.subtle, fg: colors.muted },
    negative: { bg: colors.destructive, fg: '#FFFFFF' },
  };
  const tint = badge[tone];

  const press = (to: number): void => {
    if (!onPress) return;
    Animated.timing(scale, { toValue: to, duration: motion.duration.fast, useNativeDriver: true }).start();
  };

  const sentence = actorLabel + ' ' + action;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={
          sentence + (amount ? ', ' + amount : '') + (note ? '. ' + note : '') + ', ' + timeLabel
        }
        accessibilityHint={onPress ? 'Opens the details' : undefined}
        onPress={onPress}
        onPressIn={() => press(motion.scale.pressed)}
        onPressOut={() => press(1)}
        disabled={!onPress}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: pressed ? (dark ? colors.surfaceElevated : colors.subtle) : 'transparent' },
        ]}
      >
        <View style={styles.face}>
          <SMAvatar name={actorName} size={38} round />
          <View style={[styles.badge, { backgroundColor: tint.bg, borderColor: colors.surface }]}>
            <Icon name={icon} size={10} color={tint.fg} />
          </View>
        </View>

        <View style={styles.body}>
          <Text style={[styles.sentence, { color: colors.text }]}>
            <Text style={styles.actor}>{actorLabel}</Text>
            {' ' + action}
          </Text>
          {note ? (
            <Text
              numberOfLines={2}
              style={[styles.note, { color: tone === 'negative' ? colors.destructive : colors.muted }]}
            >
              {note}
            </Text>
          ) : null}
          <Text style={[styles.time, { color: colors.muted }]}>{timeLabel}</Text>
        </View>

        {amount ? (
          <View style={styles.amount}>
            <SMAmount
              value={amount}
              size="compact"
              tone={tone === 'negative' ? 'muted' : 'default'}
              {...(emphasis ? { style: styles.amountStrong } : {})}
            />
          </View>
        ) : null}

        {onPress ? <Icon name="forward" size={13} tone="muted" /> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    minHeight: 56,
  },
  face: { width: 38, height: 38 },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2, paddingTop: 1 },
  sentence: { fontSize: typography.bodySm, lineHeight: 20 },
  actor: { fontWeight: '700' },
  note: { fontSize: typography.caption, lineHeight: 17 },
  time: { fontSize: typography.xs },
  amount: { alignItems: 'flex-end', paddingTop: 1, maxWidth: '32%' },
  amountStrong: { fontWeight: '800' },
});
