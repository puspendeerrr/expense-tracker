import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useAiChat, type AiMessage } from '@/ai/AiChatProvider';
import { routeForSource, sourceKindLabel, suggestionsFor } from '@/ai/suggestions';
import type { AiSource } from '@/api/types';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

const MAX_LENGTH = 2000;

export default function AiChatScreen() {
  const { colors } = useTheme();
  const { messages, busy, screen, send, retry, stop, clear } = useAiChat();

  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 0);
    return () => clearTimeout(timer);
  }, [messages]);

  const submit = (): void => {
    const text = input.trim();
    if (!text || busy) return;
    send(text);
    setInput('');
  };

  const empty = messages.length === 0;
  const suggestions = suggestionsFor(screen);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader
        title="SplitMoney AI"
        subtitle={busy ? 'Thinking…' : screen.label ? 'Context: ' + screen.label : 'Financial Assistant'}
        right={
          messages.length > 0 ? (
            <PrimaryButton
              label="Clear"
              variant="secondary"
              onPress={clear}
              style={styles.headerButton}
            />
          ) : undefined
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {empty ? (
            <View style={styles.intro}>
              <View style={[styles.aiIconBadge, { backgroundColor: colors.primarySubtle }]}>
                <Icon name="search" size={24} tone="primary" />
              </View>
              <Text
                accessibilityRole="header"
                style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}
              >
                Ask SplitMoney Assistant
              </Text>
              <Text style={{ color: colors.muted, fontSize: typography.bodySm, lineHeight: 22 }}>
                Ask about balances, who owes whom, recent expenses, or settlements in English or Hinglish.
                Every response is derived from your authoritative group records.
              </Text>

              <View style={styles.suggestionsContainer}>
                <Text style={{ color: colors.muted, fontSize: typography.xs, fontWeight: '700', letterSpacing: 0.8 }}>
                  SUGGESTED QUESTIONS
                </Text>
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    accessibilityRole="button"
                    accessibilityLabel={'Ask: ' + suggestion}
                    onPress={() => send(suggestion)}
                    style={({ pressed }) => [
                      styles.suggestionCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Icon name="forward" size={16} tone="primary" />
                    <Text style={{ color: colors.text, fontSize: typography.bodySm, flex: 1, fontWeight: '500' }}>
                      {suggestion}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            messages.map((message) => (
              <MessageRow key={message.id} message={message} onRetry={() => retry(message.id)} />
            ))
          )}
        </ScrollView>

        {/* Composer Bar */}
        <View style={[styles.composer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          {busy ? (
            <PrimaryButton
              label="Stop Generating"
              variant="secondary"
              icon="close"
              onPress={stop}
              style={styles.stopButton}
            />
          ) : null}

          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={(text) => setInput(text.slice(0, MAX_LENGTH))}
              placeholder="Ask anything about your expenses..."
              placeholderTextColor={colors.muted}
              selectionColor={colors.primary}
              multiline
              editable={!busy}
              accessibilityLabel="Ask a question"
              style={[
                styles.textInput,
                {
                  color: colors.text,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={input.trim().length === 0 || busy}
              onPress={submit}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor: input.trim().length > 0 && !busy ? colors.primary : colors.subtle,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Icon
                name="forward"
                size={18}
                tone={input.trim().length > 0 && !busy ? 'inverse' : 'muted'}
              />
            </Pressable>
          </View>

          {input.length > MAX_LENGTH - 200 ? (
            <Text style={{ color: colors.muted, fontSize: typography.xs, textAlign: 'right' }}>
              {MAX_LENGTH - input.length + ' characters left'}
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/* Message Bubble Component                                                   */
/* -------------------------------------------------------------------------- */

function MessageRow({ message, onRetry }: { message: AiMessage; onRetry: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const mine = message.role === 'user';

  if (mine) {
    return (
      <View style={[styles.row, styles.rowRight]}>
        <View style={[styles.bubble, styles.mineBubble, { backgroundColor: colors.primary }]}>
          <Text style={{ color: colors.onPrimary, fontSize: typography.bodySm, lineHeight: 22, fontWeight: '500' }}>
            {message.content}
          </Text>
        </View>
      </View>
    );
  }

  if (message.status === 'loading') {
    return (
      <View style={styles.row}>
        <View style={[styles.bubble, styles.aiBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TypingDots />
        </View>
      </View>
    );
  }

  if (message.status === 'error') {
    return (
      <View style={styles.row}>
        <View style={[styles.bubble, styles.aiBubble, { backgroundColor: colors.surface, borderColor: colors.destructive }]}>
          <View style={styles.errorHeader}>
            <Icon name="alert-circle" size={16} tone="destructive" />
            <Text style={{ color: colors.destructive, fontSize: typography.bodySm, fontWeight: '700' }}>
              Generation Failed
            </Text>
          </View>
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: colors.muted, fontSize: typography.caption, lineHeight: 20 }}
          >
            {message.errorText ?? 'Could not retrieve answer. Please try again.'}
          </Text>
          <PrimaryButton label="Retry" variant="secondary" onPress={onRetry} style={styles.retryButton} />
        </View>
      </View>
    );
  }

  const copy = async (): Promise<void> => {
    await Clipboard.setStringAsync(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={styles.row}>
      <View style={[styles.bubble, styles.aiBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {message.status === 'cancelled' ? (
          <Text style={{ color: colors.warning, fontSize: typography.caption, fontStyle: 'italic' }}>
            Generation was stopped.
          </Text>
        ) : (
          <>
            <RichText text={message.content} />

            {message.sources && message.sources.length > 0 ? (
              <View style={styles.sources}>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: typography.xs,
                    fontWeight: '800',
                    letterSpacing: 0.8,
                  }}
                >
                  VERIFIED SOURCES
                </Text>
                {message.sources.map((source) => (
                  <SourceCard
                    key={source.type + source.id}
                    source={source}
                    onOpen={(path) => router.push(path as never)}
                  />
                ))}
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copied ? 'Answer copied' : 'Copy answer'}
              onPress={() => void copy()}
              hitSlop={8}
              style={styles.copyButton}
            >
              <Icon name={copied ? 'check' : 'copy'} size={14} tone="primary" />
              <Text style={{ color: colors.primary, fontSize: typography.caption, fontWeight: '700' }}>
                {copied ? 'Copied' : 'Copy'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function SourceCard({ source, onOpen }: { source: AiSource; onOpen: (path: string) => void }) {
  const { colors } = useTheme();
  const path = routeForSource(source);

  const iconName: IconName =
    source.type === 'expense' ? 'tag' : source.type === 'settlement' ? 'dollar-sign' : 'users';

  const body = (
    <>
      <View style={[styles.sourceIcon, { backgroundColor: colors.subtle }]}>
        <Icon name={iconName} size={14} tone="primary" />
      </View>
      <View style={styles.sourceBody}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '600' }}>
          {source.label}
        </Text>
        <Text style={{ color: colors.muted, fontSize: typography.xs }}>
          {sourceKindLabel(source) + (source.groupName ? '  ·  ' + source.groupName : '')}
        </Text>
      </View>
      {path ? <Icon name="forward" size={14} tone="muted" /> : null}
    </>
  );

  if (!path) {
    return (
      <View style={[styles.sourceCard, { backgroundColor: colors.subtle, borderColor: colors.border }]}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={'Open ' + sourceKindLabel(source).toLowerCase() + ': ' + source.label}
      onPress={() => onOpen(path)}
      style={({ pressed }) => [
        styles.sourceCard,
        { backgroundColor: colors.subtle, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      {body}
    </Pressable>
  );
}

function RichText({ text }: { text: string }) {
  const { colors } = useTheme();
  const lines = text.split('\n');

  return (
    <View style={styles.rich}>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (trimmed === '' || trimmed === '---') return <View key={index} style={styles.gap} />;

        const bullet = /^[*-]\s+/.test(trimmed);
        const content = bullet ? trimmed.replace(/^[*-]\s+/, '') : trimmed;

        return (
          <View key={index} style={bullet ? styles.bulletRow : undefined}>
            {bullet ? (
              <Text style={{ color: colors.primary, fontSize: typography.bodySm, lineHeight: 22, marginRight: 6 }}>
                {'•'}
              </Text>
            ) : null}
            <Text style={{ color: colors.text, fontSize: typography.bodySm, lineHeight: 22, flex: 1 }}>
              {segments(content).map((segment, part) => (
                <Text
                  key={part}
                  style={segment.bold ? { fontWeight: '800' } : undefined}
                >
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

const segments = (line: string): { text: string; bold: boolean }[] =>
  line
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('**') && part.endsWith('**')
        ? { text: part.slice(2, -2), bold: true }
        : { text: part, bold: false },
    );

function TypingDots() {
  const { colors } = useTheme();
  const values = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const animations = values.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(value, { toValue: 1, duration: 320, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.3, duration: 320, easing: Easing.ease, useNativeDriver: true }),
          Animated.delay(320 - index * 160),
        ]),
      ),
    );
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [values]);

  return (
    <View
      style={styles.dots}
      accessibilityLiveRegion="polite"
      accessibilityLabel="SplitMoney AI is generating an answer"
    >
      {values.map((value, index) => (
        <Animated.View
          key={index}
          style={[styles.dot, { backgroundColor: colors.primary, opacity: value }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  headerButton: { minHeight: 34, paddingVertical: spacing.xxs, paddingHorizontal: spacing.sm },
  thread: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  intro: { gap: spacing.md, paddingTop: spacing.md, alignItems: 'center' },
  aiIconBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionsContainer: { width: '100%', gap: spacing.sm, paddingTop: spacing.md },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  row: { flexDirection: 'row' },
  rowRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '88%', padding: spacing.md, borderRadius: radius.lg, gap: spacing.sm },
  mineBubble: { borderBottomRightRadius: radius.xs },
  aiBubble: { borderWidth: 1, borderBottomLeftRadius: radius.xs },
  errorHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  retryButton: { minHeight: 32, paddingVertical: spacing.xxs, paddingHorizontal: spacing.sm, alignSelf: 'flex-start' },
  rich: { gap: 2 },
  gap: { height: spacing.xs },
  bulletRow: { flexDirection: 'row' },
  sources: { gap: spacing.xs, paddingTop: spacing.xs },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  sourceIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceBody: { flex: 1, gap: 2 },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingTop: spacing.xs,
  },
  composer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  stopButton: { minHeight: 36, paddingVertical: spacing.xxs },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.bodySm,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
