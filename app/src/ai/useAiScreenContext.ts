import { useEffect } from 'react';
import { useAiChat, type AiScreenContext } from './AiChatProvider';

/**
 * Tells the assistant what the person is looking at, by NAME.
 *
 * Only the label is used, and only to word the suggested questions ("Why do I owe
 * Rahul?"). No id is sent to the server: the backend resolves the name against the user's
 * own authorised data, exactly as if they had typed it. Called once the screen's data has
 * loaded, so the label is always the real one and never the previous screen's.
 */
export function useAiScreenContext(kind: Exclude<AiScreenContext['kind'], 'none'>, label: string | null | undefined) {
  const { setScreen } = useAiChat();
  useEffect(() => {
    const name = label?.trim();
    if (name) setScreen({ kind, label: name });
  }, [kind, label, setScreen]);
}
