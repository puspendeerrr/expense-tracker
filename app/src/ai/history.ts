/**
 * The conversation context sent with each question, built from answered pairs only.
 *
 * WHY PAIRS. User messages are always stored as complete — it is their ANSWER that can
 * fail or be stopped. Filtering on "complete" alone therefore kept unanswered questions:
 * after a failure, the next request carried the orphaned question, putting two user turns
 * back to back; and retrying a failed question sent it twice, once in history and once as
 * the message. Taking only a question together with the complete answer that follows it
 * removes both problems, and keeps the roles alternating.
 *
 * BOUNDED TO THE SERVER'S SCHEMA (server/src/validation/aiSchemas.ts): at most ten
 * entries, i.e. five pairs, the most recent kept; and no entry over 4,000 characters. A
 * long answer is shortened rather than dropped — it is context, not a record — because an
 * over-long entry would make every later request fail with a 400.
 */

export const HISTORY_ENTRY_LIMIT = 10;
export const HISTORY_CONTENT_LIMIT = 4000;
export const MESSAGE_LIMIT = 2000;

type Turn = { role: 'user' | 'assistant'; content: string; status: string };
export type HistoryItem = { role: 'user' | 'assistant'; content: string };

const fit = (text: string): string =>
  text.length <= HISTORY_CONTENT_LIMIT ? text : text.slice(0, HISTORY_CONTENT_LIMIT - 1) + '…';

export function buildHistory(messages: Turn[]): HistoryItem[] {
  const pairs: [HistoryItem, HistoryItem][] = [];

  for (let i = 0; i < messages.length - 1; i += 1) {
    const question = messages[i];
    const answer = messages[i + 1];
    if (
      question?.role === 'user' &&
      question.content.trim() &&
      answer?.role === 'assistant' &&
      answer.status === 'complete' &&
      answer.content.trim()
    ) {
      pairs.push([
        { role: 'user', content: fit(question.content) },
        { role: 'assistant', content: fit(answer.content) },
      ]);
      i += 1;
    }
  }

  return pairs.slice(-Math.floor(HISTORY_ENTRY_LIMIT / 2)).flat();
}
