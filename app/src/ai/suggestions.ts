import type { AiScreenContext } from './AiChatProvider';
import type { AiSource } from '@/api/types';

/**
 * What to offer someone staring at an empty chat.
 *
 * The contextual ones NAME the thing they are about — "in Apartment 402", not "in this
 * group". That is deliberate and it is the whole of the screen-awareness design: the
 * backend does not accept a context id, and would not trust one if it did, so the context
 * travels as part of the question and is resolved against the user's own authorised data
 * exactly as if they had typed it.
 *
 * Nothing here fabricates an answer or asserts a fact. A suggestion is a question.
 */

const GENERAL = [
  'What do I owe everyone?',
  'Who owes me money?',
  'How much did I spend this month?',
  'Show my pending settlements.',
  'Mujhe kitna paisa dena hai?',
];

export const suggestionsFor = (context: AiScreenContext): string[] => {
  const name = context.label?.trim();

  if (context.kind === 'group' && name) {
    return [
      'What is my balance in ' + name + '?',
      'Who owes me in ' + name + '?',
      'What did we spend in ' + name + ' this month?',
      name + ' ka pending settlement dikhao.',
    ];
  }

  if (context.kind === 'person' && name) {
    return [
      'Why do I owe ' + name + '?',
      'Which expenses caused my balance with ' + name + '?',
      'How much have I already settled with ' + name + '?',
      name + ' ko kitna dena hai?',
    ];
  }

  if (context.kind === 'expense' && name) {
    return [
      'Why is my share of ' + name + ' this much?',
      'Who paid for ' + name + '?',
      'How was ' + name + ' split?',
    ];
  }

  if (context.kind === 'settlement' && name) {
    return [
      'Explain the settlement ' + name + '.',
      'How much do I still owe after this?',
      'Why is this payment still pending?',
    ];
  }

  return GENERAL;
};

/**
 * Where a source card leads.
 *
 * Returns null when there is nowhere to go — a member source without a group cannot be
 * addressed, because every person screen lives under a group. A card that leads nowhere
 * is rendered as plain information rather than as a broken button.
 *
 * The id is not trusted. It addresses a screen, and that screen fetches through the
 * normal API where the server decides whether this user may see it.
 */
export const routeForSource = (source: AiSource): string | null => {
  switch (source.type) {
    case 'group':
      return '/group/' + source.id;
    case 'expense':
      return source.groupId ? '/group/' + source.groupId + '/expense/' + source.id : null;
    case 'settlement':
      return source.groupId ? '/group/' + source.groupId + '/settlement/' + source.id : null;
    case 'member':
      return source.groupId ? '/group/' + source.groupId + '/person/' + source.id : null;
    default:
      return null;
  }
};

const SOURCE_LABEL: Record<AiSource['type'], string> = {
  expense: 'Expense',
  settlement: 'Settlement',
  group: 'Group',
  member: 'Person',
};

export const sourceKindLabel = (source: AiSource): string => SOURCE_LABEL[source.type] ?? 'Record';
