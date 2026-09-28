import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useAiChat, type AiMessage } from '@/ai/AiChatProvider';
import { MESSAGE_LIMIT } from '@/ai/history';
import { routeForSource, sourceKindLabel, suggestionsFor } from '@/ai/suggestions';
import type { AiSource } from '@/api/types';
import {
  SMAiAssistantMessage,
  SMAiComposer,
  SMAiSourceCard,
  SMAiSuggestion,
  SMAiUserMessage,
  SMConfirmSheet,
  SMScreenHeader,
} from '@/components/sm';
import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';

const SOURCE_ICON: Record<AiSource['type'], IconName> = {
  expense: 'expense',
  settlement: 'settlement',
  group: 'group',
  member: 'user',
};

/**
 * SplitMoney AI.
 *
 * A client of the existing `/api/ai/chat` and nothing more. The conversation lives in
 * `AiChatProvider` — React state above the router — so it survives leaving this screen and
 * coming back, and is gone on sign-out or a relaunch. Nothing is stored anywhere.
 *
 * The assistant only reads. Its answers explain; the figures of record are on the screens
 * its sources open, and those screens are where anything can actually be changed.
 */
export default function AiChatScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { messages, busy, screen, send, retry, stop, clear } = useAiChat();

  const [input, setInput] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
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

  const back = (): void => (router.canGoBack() ? router.back() : router.replace('/home'));
  const empty = messages.length === 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
      <SMScreenHeader
        title="SplitMoney AI"
        subtitle={busy ? 'Thinking…' : 'Answers from your groups'}
        onBack={back}
        {...(!empty && !busy
          ? { action: { icon: 'trash' as IconName, label: 'Clear conversation', onPress: () => setConfirmClear(true) } }
          : {})}
      />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {empty ? (
            <View style={styles.intro}>
              <View style={[styles.mark, { backgroundColor: colors.primarySubtle ?? colors.subtle }]}>
                <Icon name="ai" size={26} tone="primary" />
              </View>
              <Text accessibilityRole="header" style={[styles.introTitle, { color: colors.text }]}>
                Ask about your money
              </Text>
              <Text style={[styles.introBody, { color: colors.muted }]}>
                Balances, who owes whom, recent expenses and payments — in English, Hindi or Hinglish.
                Each answer links to the records it used, so you can check the exact figures.
              </Text>

              <View style={styles.suggestions}>
                {suggestionsFor(screen).map((suggestion) => (
                  <SMAiSuggestion key={suggestion} text={suggestion} onPress={() => send(suggestion)} />
                ))}
              </View>

              <Text style={[styles.readOnly, { color: colors.muted }]}>
                The assistant can’t change anything — it only reads what you can already see.
              </Text>
            </View>
          ) : (
            messages.map((message) =>
              message.role === 'user' ? (
                <SMAiUserMessage key={message.id} text={message.content} />
              ) : (
                <AssistantTurn key={message.id} message={message} onRetry={() => retry(message.id)} />
              ),
            )
          )}
        </ScrollView>

        <SMAiComposer
          value={input}
          onChangeText={setInput}
          onSend={submit}
          onStop={stop}
          busy={busy}
          maxLength={MESSAGE_LIMIT}
        />
      </KeyboardAvoidingView>

      <SMConfirmSheet
        visible={confirmClear}
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clear();
          setConfirmClear(false);
        }}
        icon="trash"
        title="Clear this conversation?"
        description="It isn’t saved anywhere, so it can’t be brought back."
        confirmLabel="Clear"
        cancelLabel="Keep it"
      />
    </SafeAreaView>
  );
}

function AssistantTurn({ message, onRetry }: { message: AiMessage; onRetry: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  if (message.status !== 'complete') {
    return (
      <SMAiAssistantMessage
        state={message.status}
        {...(message.errorText ? { errorText: message.errorText } : {})}
        {...(message.status === 'error' ? { onRetry } : {})}
      />
    );
  }

  const copy = async (): Promise<void> => {
    await Clipboard.setStringAsync(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const sources = message.sources ?? [];

  return (
    <SMAiAssistantMessage
      state="complete"
      text={message.content}
      footer={
        <>
          {sources.length > 0 ? (
            <View style={styles.sources}>
              <Text style={[styles.sourcesTitle, { color: colors.muted }]}>Based on</Text>
              {sources.map((source) => {
                const path = routeForSource(source);
                return (
                  <SMAiSourceCard
                    key={source.type + source.id}
                    label={source.label}
                    kindLabel={sourceKindLabel(source)}
                    {...(source.groupName ? { groupName: source.groupName } : {})}
                    icon={SOURCE_ICON[source.type] ?? 'info'}
                    {...(path ? { onPress: () => router.push(path as never) } : {})}
                  />
                );
              })}
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copied ? 'Answer copied' : 'Copy answer'}
            onPress={() => void copy()}
            hitSlop={8}
            style={({ pressed }) => [styles.copy, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Icon name={copied ? 'check' : 'copy'} size={13} tone="primary" />
            <Text style={[styles.copyText, { color: colors.primary }]}>{copied ? 'Copied' : 'Copy'}</Text>
          </Pressable>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  thread: { padding: spacing.base, gap: spacing.md, paddingBottom: spacing.lg },
  intro: { gap: spacing.md, paddingTop: spacing.lg },
  mark: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  introTitle: { fontSize: typography.title, fontWeight: '800', letterSpacing: -0.4 },
  introBody: { fontSize: typography.bodySm, lineHeight: 21 },
  suggestions: { gap: spacing.sm, paddingTop: spacing.xs },
  readOnly: { fontSize: typography.xs, lineHeight: 16, paddingTop: spacing.xs },
  sources: { gap: spacing.xs },
  sourcesTitle: { fontSize: typography.xs, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', minHeight: 28 },
  copyText: { fontSize: typography.caption, fontWeight: '700' },
});
