import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

/* ========================================================================== */
/* Formatted answer text                                                      */
/* ========================================================================== */

const segments = (line: string): { text: string; bold: boolean }[] =>
  line
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('**') && part.endsWith('**') ? { text: part.slice(2, -2), bold: true } : { text: part, bold: false },
    );

/**
 * The assistant's answer, with the little formatting it actually uses: paragraphs,
 * "-"/"*" bullet lines and **bold**. Deliberately not a Markdown renderer — the answers
 * need nothing more, and a full renderer is a large dependency for three rules.
 * Bullets are drawn as dots rather than a text glyph, so they sit on the line consistently.
 */
export function SMAiText({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.rich}>
      {text.split('\n').map((line, index) => {
        const trimmed = line.trim();
        if (trimmed === '' || trimmed === '---') return <View key={index} style={styles.gap} />;
        const bullet = /^[*-]\s+/.test(trimmed);
        const content = bullet ? trimmed.replace(/^[*-]\s+/, '') : trimmed;
        return (
          <View key={index} style={bullet ? styles.bulletRow : null}>
            {bullet ? <View style={[styles.bulletDot, { backgroundColor: colors.primary }]} /> : null}
            <Text style={[styles.body, { color: colors.text }]}>
              {segments(content).map((segment, part) => (
                <Text key={part} style={segment.bold ? styles.bold : null}>
                  {segment.text}
                </Text>
              ))}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/* ========================================================================== */
/* Typing indicator                                                           */
/* ========================================================================== */

/** Three dots breathing in sequence. Announced once as "Thinking", not as motion. */
export function SMAiTyping() {
  const { colors } = useTheme();
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const loops = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(dot, { toValue: 1, duration: 360, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 360, useNativeDriver: true }),
          Animated.delay((2 - index) * 160),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots]);

  return (
    <View accessible accessibilityLabel="Thinking" accessibilityLiveRegion="polite" style={styles.typing}>
      {dots.map((dot, index) => (
        <Animated.View key={index} style={[styles.typingDot, { backgroundColor: colors.muted, opacity: dot }]} />
      ))}
    </View>
  );
}

/* ========================================================================== */
/* Messages                                                                   */
/* ========================================================================== */

/** The person's own question: right-aligned, in the brand colour, nothing else. */
export function SMAiUserMessage({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, styles.rowEnd]}>
      <View
        accessible
        accessibilityLabel={'You asked: ' + text}
        style={[styles.userBubble, { backgroundColor: colors.primary }]}
      >
        <Text style={[styles.body, { color: colors.onPrimary ?? '#FFFFFF' }]}>{text}</Text>
      </View>
    </View>
  );
}

/**
 * The assistant's turn, in any of its states. An answer sits on a quiet surface at reading
 * width, with what it was based on underneath; a failure says why and offers to try the same
 * question again; a stopped answer says it was stopped rather than looking unfinished.
 */
export function SMAiAssistantMessage({
  state,
  text,
  errorText,
  footer,
  onRetry,
}: {
  state: 'loading' | 'complete' | 'error' | 'cancelled';
  text?: string;
  errorText?: string;
  /** Sources and the copy action, for a complete answer. */
  footer?: React.ReactNode;
  onRetry?: () => void;
}) {
  const { colors, dark } = useTheme();

  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: colors.primarySubtle ?? colors.subtle }]}>
        <Icon name="ai" size={14} tone="primary" />
      </View>
      <View
        style={[
          styles.aiBubble,
          {
            backgroundColor: dark ? colors.surface : colors.surfaceElevated ?? colors.surface,
            borderColor: state === 'error' ? colors.destructive : dark ? colors.borderStrong : colors.border,
          },
        ]}
      >
        {state === 'loading' ? (
          <SMAiTyping />
        ) : state === 'error' ? (
          <View style={styles.stack} accessibilityLiveRegion="polite">
            <View style={styles.inline}>
              <Icon name="alertCircle" size={15} tone="destructive" />
              <Text style={[styles.errorTitle, { color: colors.destructive }]}>Couldn’t answer that</Text>
            </View>
            <Text style={[styles.meta, { color: colors.muted }]}>
              {errorText ?? 'Something went wrong. Please try again.'}
            </Text>
            {onRetry ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ask the same question again"
                onPress={onRetry}
                hitSlop={8}
                style={({ pressed }) => [styles.inline, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Icon name="refresh" size={14} tone="primary" />
                <Text style={[styles.action, { color: colors.primary }]}>Try again</Text>
              </Pressable>
            ) : null}
          </View>
        ) : state === 'cancelled' ? (
          <Text style={[styles.meta, styles.italic, { color: colors.muted }]}>Generation was stopped.</Text>
        ) : (
          <View style={styles.stack}>
            <SMAiText text={text ?? ''} />
            {footer}
          </View>
        )}
      </View>
    </View>
  );
}

/* ========================================================================== */
/* Source card                                                                */
/* ========================================================================== */

/**
 * A record the answer drew on. Shows only what the server supplied — its label, its kind,
 * its group — and opens that record's real screen, which checks access afresh. Without a
 * group there is no screen to open, so the card is plain information, not a dead button.
 */
export function SMAiSourceCard({
  label,
  kindLabel,
  groupName,
  icon,
  onPress,
}: {
  label: string;
  kindLabel: string;
  groupName?: string;
  icon: IconName;
  onPress?: () => void;
}) {
  const { colors, dark } = useTheme();
  const meta = kindLabel + (groupName ? ' · ' + groupName : '');

  const inner = (
    <>
      <View style={[styles.sourceIcon, { backgroundColor: colors.primarySubtle ?? colors.subtle }]}>
        <Icon name={icon} size={14} tone="primary" />
      </View>
      <View style={styles.sourceBody}>
        <Text numberOfLines={1} style={[styles.sourceLabel, { color: colors.text }]}>
          {label}
        </Text>
        <Text numberOfLines={1} style={[styles.sourceMeta, { color: colors.muted }]}>
          {meta}
        </Text>
      </View>
      {onPress ? <Icon name="forward" size={13} tone="muted" /> : null}
    </>
  );

  const surface = {
    borderColor: dark ? colors.borderStrong : colors.border,
    backgroundColor: dark ? colors.background : colors.surface,
  };

  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={'Open ' + kindLabel.toLowerCase() + ' ' + label + (groupName ? ' in ' + groupName : '')}
      onPress={onPress}
      style={({ pressed }) => [styles.source, surface, { opacity: pressed ? 0.8 : 1 }]}
    >
      {inner}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={kindLabel + ' ' + label} style={[styles.source, surface]}>
      {inner}
    </View>
  );
}

/* ========================================================================== */
/* Suggestion                                                                 */
/* ========================================================================== */

export function SMAiSuggestion({ text, onPress }: { text: string; onPress: () => void }) {
  const { colors, dark } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={'Ask: ' + text}
      onPress={onPress}
      style={({ pressed }) => [
        styles.suggestion,
        {
          backgroundColor: pressed ? colors.primarySubtle ?? colors.subtle : dark ? colors.surface : colors.surfaceElevated ?? colors.surface,
          borderColor: dark ? colors.borderStrong : colors.border,
        },
      ]}
    >
      <Icon name="ai" size={14} tone="primary" />
      <Text style={[styles.suggestionText, { color: colors.text }]}>{text}</Text>
    </Pressable>
  );
}

/* ========================================================================== */
/* Composer                                                                   */
/* ========================================================================== */

/**
 * Where the question is typed. While an answer is being generated the send button BECOMES
 * the stop button — same place, same size — so stopping is where the thumb already is.
 * Length is capped at the server's limit as it is typed, with a countdown near the end.
 */
export function SMAiComposer({
  value,
  onChangeText,
  onSend,
  onStop,
  busy,
  maxLength,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  maxLength: number;
}) {
  const { colors, dark } = useTheme();
  const [focused, setFocused] = useState(false);
  const canSend = value.trim().length > 0 && !busy;
  const left = maxLength - value.length;

  return (
    <View
      style={[
        styles.composer,
        { borderTopColor: dark ? colors.borderStrong : colors.border, backgroundColor: colors.background },
      ]}
    >
      <View
        style={[
          styles.field,
          {
            borderColor: focused ? colors.primary : dark ? colors.borderStrong : colors.border,
            backgroundColor: dark ? colors.surface : colors.surfaceElevated ?? colors.surface,
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={(text) => onChangeText(text.slice(0, maxLength))}
          placeholder="Ask about your balances, expenses…"
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
          multiline
          editable={!busy}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel="Your question"
          style={[styles.input, { color: colors.text }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={busy ? 'Stop generating' : 'Send question'}
          accessibilityState={{ disabled: !busy && !canSend }}
          disabled={!busy && !canSend}
          onPress={busy ? onStop : onSend}
          hitSlop={6}
          style={({ pressed }) => [
            styles.send,
            {
              backgroundColor: busy ? colors.destructive : canSend ? colors.primary : dark ? colors.surfaceElevated : colors.subtle,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Icon
            name={busy ? 'stop' : 'send'}
            size={16}
            color={busy || canSend ? '#FFFFFF' : colors.muted}
          />
        </Pressable>
      </View>
      {left <= 200 ? (
        <Text style={[styles.counter, { color: left <= 20 ? colors.destructive : colors.muted }]}>
          {left + ' characters left'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rich: { gap: 2 },
  gap: { height: spacing.sm },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingLeft: 2 },
  bulletDot: { width: 5, height: 5, borderRadius: 3, marginTop: 9 },
  body: { flexShrink: 1, fontSize: typography.bodySm, lineHeight: 22 },
  bold: { fontWeight: '800' },
  typing: { flexDirection: 'row', gap: 5, paddingVertical: 6 },
  typingDot: { width: 7, height: 7, borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rowEnd: { justifyContent: 'flex-end' },
  userBubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    borderBottomRightRadius: radius.xs,
  },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  aiBubble: {
    flex: 1,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    borderTopLeftRadius: radius.xs,
  },
  stack: { gap: spacing.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  errorTitle: { fontSize: typography.bodySm, fontWeight: '700' },
  meta: { fontSize: typography.caption, lineHeight: 18 },
  italic: { fontStyle: 'italic' },
  action: { fontSize: typography.caption, fontWeight: '700' },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: 48,
  },
  sourceIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sourceBody: { flex: 1, gap: 1 },
  sourceLabel: { fontSize: typography.caption, fontWeight: '700' },
  sourceMeta: { fontSize: typography.xs },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  suggestionText: { flex: 1, fontSize: typography.bodySm, fontWeight: '600' },
  composer: { paddingHorizontal: spacing.base, paddingVertical: spacing.sm, borderTopWidth: 1, gap: 4 },
  field: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingLeft: spacing.md,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: { flex: 1, fontSize: typography.bodySm, maxHeight: 120, paddingVertical: 8 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  counter: { fontSize: typography.xs, textAlign: 'right' },
});

