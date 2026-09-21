import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { ai as aiApi } from '@/api/endpoints';
import { ApiError, NetworkError, describeError } from '@/api/errors';
import type { AiHistoryItem, AiSource } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';

/**
 * The assistant's conversation. In memory, and nowhere else.
 *
 * WHY NOTHING IS PERSISTED
 * A conversation about money is a conversation about money: it names what you owe, who
 * you owe it to and what you bought. Writing that to a database would create a second
 * copy of financial information outside the tables that own it, and writing it to the
 * device would leave it readable on a phone somebody else might end up holding. Neither
 * buys the user much — a question you asked last Tuesday is rarely one you want back —
 * so the conversation lives for as long as the app process does and then it is gone.
 *
 * That is a deliberate product decision, not an omission, and it is why this file uses
 * `useState` and nothing else. There is no AsyncStorage, no SecureStore, no SQLite and no
 * server-side chat table anywhere in this feature.
 *
 * The provider sits above the router, so the conversation survives closing the chat and
 * navigating around the app, and dies with a reload or a force-quit. It is also cleared
 * on sign-out, because the next person to sign in on this phone has no business seeing
 * the previous account's questions.
 *
 * WHERE THE ANSWERS COME FROM
 * Not from here. `POST /api/ai/chat` runs the existing service: it retrieves the user's
 * own authorised rows from PostgreSQL, hands them to Gemini as grounding, and returns an
 * answer plus the records it used. This file sends a question and renders a reply. It
 * computes no balance, and it treats the model's arithmetic as prose rather than truth —
 * the figures worth acting on are reached through the source cards, which open the real
 * screens backed by the real API.
 */

export type AiMessageStatus = 'complete' | 'loading' | 'error' | 'cancelled';

export type AiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: AiMessageStatus;
  sources?: AiSource[];
  /** Present on an error message, so Retry knows what to send again. */
  failedPrompt?: string;
  errorText?: string;
  at: number;
};

export type AiStatus = 'idle' | 'sending' | 'generating' | 'success' | 'error' | 'cancelled';

/**
 * Where the chat was opened from, so the empty state can suggest something relevant.
 *
 * Ids are NOT sent to the server as authorisation hints — the backend does not accept
 * such a field, and would not trust it if it did. They are used to look up a NAME, so a
 * suggested question can say "in Apartment 402" instead of "in this group". The backend
 * then resolves that against the user's own authorised data, exactly as it would for a
 * question somebody typed themselves.
 */
export type AiScreenContext = {
  kind: 'group' | 'expense' | 'settlement' | 'person' | 'none';
  label?: string;
  groupId?: string;
};

type AiContextValue = {
  messages: AiMessage[];
  status: AiStatus;
  /** True while a request is in flight; used to disable send and show Stop. */
  busy: boolean;
  screen: AiScreenContext;
  setScreen: (context: AiScreenContext) => void;
  send: (text: string) => void;
  retry: (messageId: string) => void;
  stop: () => void;
  clear: () => void;
};

const AiChatContext = createContext<AiContextValue | null>(null);

/**
 * The backend bounds history to 10 messages and rejects more with a 400. Matching it here
 * means the limit is enforced before a request is spent finding out.
 */
const HISTORY_LIMIT = 10;

let counter = 0;
/** Ids only need to be unique within one process, which a counter guarantees. */
const nextId = (): string => 'm' + ++counter;

export function AiChatProvider({ children }: PropsWithChildren) {
  const { status: authStatus } = useAuth();

  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [status, setStatus] = useState<AiStatus>('idle');
  const [screen, setScreen] = useState<AiScreenContext>({ kind: 'none' });

  const controllerRef = useRef<AbortController | null>(null);
  const busy = status === 'sending' || status === 'generating';

  /* ---- Sign-out wipes the conversation ---- */

  const wasAuthed = useRef(false);
  useEffect(() => {
    if (authStatus === 'authenticated') wasAuthed.current = true;
    if (authStatus === 'anonymous' && wasAuthed.current) {
      wasAuthed.current = false;
      controllerRef.current?.abort();
      controllerRef.current = null;
      setMessages([]);
      setStatus('idle');
      setScreen({ kind: 'none' });
    }
  }, [authStatus]);

  /** Aborts anything in flight when the provider goes away. */
  useEffect(() => () => controllerRef.current?.abort(), []);

  const stop = useCallback(() => {
    if (!controllerRef.current) return;
    controllerRef.current.abort();
    controllerRef.current = null;

    setMessages((current) =>
      current.map((message) =>
        message.status === 'loading'
          ? {
              ...message,
              status: 'cancelled',
              content: message.content || 'Generation was stopped.',
            }
          : message,
      ),
    );
    setStatus('cancelled');
  }, []);

  const clear = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setMessages([]);
    setStatus('idle');
  }, []);

  /**
   * Sends one question.
   *
   * `existingUserId` is set when retrying: the user's message is already on screen, so a
   * retry must replace the failed answer rather than append the question a second time.
   */
  const run = useCallback(
    (text: string, existingUserId?: string) => {
      const prompt = text.trim();
      if (!prompt || busy) return;

      // A second send while one is running would leave two answers racing for the same
      // slot. The previous one loses.
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      const assistantId = nextId();

      /*
       * History is built from COMPLETED turns only. A failed or cancelled message has no
       * content worth carrying, and sending an empty assistant turn would spend part of
       * the ten-message budget saying nothing.
       */
      const history: AiHistoryItem[] = messages
        .filter((message) => message.status === 'complete' && message.content.trim().length > 0)
        .slice(-HISTORY_LIMIT)
        .map((message) => ({ role: message.role, content: message.content }));

      setMessages((current) => {
        const withoutFailed = existingUserId
          ? current.filter(
              (message) =>
                !(message.role === 'assistant' && message.failedPrompt === prompt && message.status === 'error'),
            )
          : current;

        const userTurn: AiMessage[] = existingUserId
          ? []
          : [{ id: nextId(), role: 'user', content: prompt, status: 'complete', at: Date.now() }];

        return [
          ...withoutFailed,
          ...userTurn,
          { id: assistantId, role: 'assistant', content: '', status: 'loading', at: Date.now() },
        ];
      });

      setStatus('sending');

      void (async () => {
        try {
          setStatus('generating');
          const response = await aiApi.chat(prompt, history, controller.signal);

          if (controller.signal.aborted) return;

          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    content: response.answer,
                    sources: response.sources,
                    status: 'complete',
                  }
                : message,
            ),
          );
          setStatus('success');
        } catch (error: unknown) {
          // `stop` has already rewritten the message; saying anything else would undo it.
          if (controller.signal.aborted) return;

          const described = describeError(error);
          const message =
            error instanceof ApiError && error.status === 429
              ? 'You have asked a lot of questions recently. Try again in a few minutes.'
              : error instanceof ApiError && error.isUnauthenticated
                ? 'Your session expired. Please sign in again.'
                : error instanceof NetworkError && error.timedOut
                  ? 'The assistant took too long to answer. It may be busy.'
                  : described.message;

          setMessages((current) =>
            current.map((entry) =>
              entry.id === assistantId
                ? { ...entry, status: 'error', errorText: message, failedPrompt: prompt }
                : entry,
            ),
          );
          setStatus('error');
        } finally {
          if (controllerRef.current === controller) controllerRef.current = null;
        }
      })();
    },
    [busy, messages],
  );

  const send = useCallback((text: string) => run(text), [run]);

  const retry = useCallback(
    (messageId: string) => {
      const failed = messages.find((message) => message.id === messageId);
      if (!failed?.failedPrompt) return;
      // Re-sends only the failed question. Nothing already answered is sent again.
      run(failed.failedPrompt, messageId);
    },
    [messages, run],
  );

  const value = useMemo<AiContextValue>(
    () => ({ messages, status, busy, screen, setScreen, send, retry, stop, clear }),
    [messages, status, busy, screen, send, retry, stop, clear],
  );

  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>;
}

export function useAiChat(): AiContextValue {
  const value = useContext(AiChatContext);
  if (!value) throw new Error('useAiChat requires AiChatProvider');
  return value;
}
