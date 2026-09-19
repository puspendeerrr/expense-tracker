import { type User } from '../db/schema.js';
import { formatPaise } from '../utils/money.js';
import { logger } from '../utils/logger.js';
import { listUserGroups, listGroupMembers } from './groupService.js';
import { getUserBalanceSummary, getPairwiseDebts } from './balanceService.js';
import { listExpenses } from './expenseService.js';
import { listSettlements, getAttentionItems } from './settlementService.js';
import { listActivities } from './activityService.js';
import { search } from './searchService.js';
import {
  callGemini,
  isGeminiConfigured,
  type GeminiChatHistoryItem,
} from './geminiClient.js';

export type AiSourceType = 'expense' | 'settlement' | 'group' | 'member';

export type AiSource = {
  type: AiSourceType;
  id: string;
  label: string;
  groupId?: string;
  groupName?: string;
};

export type AiChatResult = {
  answer: string;
  sources: AiSource[];
  intent: string;
  language: 'en' | 'hi' | 'hinglish';
  metadata: {
    tokensUsed?: number;
    latencyMs: number;
    dataPointsUsed: number;
  };
};

export type ChatServiceInput = {
  user: User;
  message: string;
  history: GeminiChatHistoryItem[];
  signal?: AbortSignal;
};

// Hindi / Hinglish detection wordlist
const HINGLISH_MARKERS = new Set([
  'hai', 'hain', 'ho', 'kya', 'kyun', 'kyu', 'kaise', 'kab', 'kahan',
  'mera', 'meri', 'mere', 'mujhe', 'hum', 'humare', 'apna', 'apne',
  'kitna', 'kitne', 'kitni', 'paisa', 'paise', 'rupaye', 'rupay',
  'dena', 'deni', 'deney', 'lena', 'leni', 'dega', 'degi', 'dege',
  'kisne', 'kisko', 'kispe', 'kisne', 'kisi', 'karega', 'karo', 'karna',
  'bhai', 'yaar', 'dost', 'hisab', 'kharcha', 'kharch', 'bhej', 'bheja',
  'chahiye', 'tha', 'thi', 'the', 'nahi', 'matlab', 'batana', 'batao',
]);

/**
 * Detects whether the user's prompt is English or Hindi/Hinglish.
 */
export const detectLanguage = (text: string): 'en' | 'hinglish' => {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let hinglishHits = 0;
  for (const word of words) {
    if (HINGLISH_MARKERS.has(word)) {
      hinglishHits++;
    }
  }

  // If at least 1 strong Hinglish word or >15% of words are Hinglish
  if (hinglishHits >= 2 || (words.length > 0 && hinglishHits / words.length >= 0.15)) {
    return 'hinglish';
  }

  return 'en';
};

export type ClassifiedIntent =
  | 'balance'
  | 'expense'
  | 'settlement'
  | 'group'
  | 'activity'
  | 'search'
  | 'general';

/**
 * Classifies the query intent to fetch minimal, highly relevant domain data.
 */
export const classifyIntent = (message: string, history: GeminiChatHistoryItem[]): ClassifiedIntent => {
  const fullText = [
    ...history.slice(-2).map((h) => h.content),
    message,
  ]
    .join(' ')
    .toLowerCase();

  if (
    fullText.includes('owe') ||
    fullText.includes('debt') ||
    fullText.includes('balance') ||
    fullText.includes('dues') ||
    fullText.includes('dena') ||
    fullText.includes('lena') ||
    fullText.includes('hisab') ||
    fullText.includes('kitna') ||
    fullText.includes('who owes') ||
    fullText.includes('how much do i')
  ) {
    return 'balance';
  }

  if (
    fullText.includes('expense') ||
    fullText.includes('spend') ||
    fullText.includes('spent') ||
    fullText.includes('bought') ||
    fullText.includes('kharcha') ||
    fullText.includes('grocery') ||
    fullText.includes('groceries') ||
    fullText.includes('dinner') ||
    fullText.includes('food') ||
    fullText.includes('rent') ||
    fullText.includes('bill') ||
    fullText.includes('receipt') ||
    fullText.includes('cost') ||
    fullText.includes('paid for')
  ) {
    return 'expense';
  }

  if (
    fullText.includes('settle') ||
    fullText.includes('settlement') ||
    fullText.includes('payment') ||
    fullText.includes('paid') ||
    fullText.includes('approved') ||
    fullText.includes('rejected') ||
    fullText.includes('pending') ||
    fullText.includes('upi') ||
    fullText.includes('proof') ||
    fullText.includes('paypanel')
  ) {
    return 'settlement';
  }

  if (
    fullText.includes('activity') ||
    fullText.includes('recent') ||
    fullText.includes('happened') ||
    fullText.includes('log') ||
    fullText.includes('history') ||
    fullText.includes('action') ||
    fullText.includes('kya hua')
  ) {
    return 'activity';
  }

  if (
    fullText.includes('search') ||
    fullText.includes('find') ||
    fullText.includes('look for') ||
    fullText.includes('dhundo') ||
    fullText.includes('pizza')
  ) {
    return 'search';
  }

  if (
    fullText.includes('group') ||
    fullText.includes('member') ||
    fullText.includes('flat') ||
    fullText.includes('roommate') ||
    fullText.includes('kaun hai') ||
    fullText.includes('who is in')
  ) {
    return 'group';
  }

  return 'general';
};

/**
 * Builds structured domain context by querying authoritative services.
 * All queries are strictly scoped to the authenticated user's groups.
 */
const buildDomainContext = async (
  user: User,
  intent: ClassifiedIntent,
  message: string,
): Promise<{
  contextText: string;
  sources: AiSource[];
  dataPointsUsed: number;
}> => {
  const userGroups = await listUserGroups(user.id);
  const sources: AiSource[] = [];
  let dataPointsUsed = 0;

  if (userGroups.length === 0) {
    return {
      contextText: `User ${user.fullName} (${user.email}) does not belong to any groups yet. They have zero balances, no expenses, and no settlements.`,
      sources: [],
      dataPointsUsed: 0,
    };
  }

  const contextParts: string[] = [
    `CURRENT USER: ${user.fullName} (Email: ${user.email}, ID: ${user.id})`,
    `GROUPS USER BELONGS TO:`,
  ];

  for (const ug of userGroups) {
    contextParts.push(`- Group "${ug.group.name}" (Role: ${ug.membership.role}, Members: ${ug.memberCount})`);
    sources.push({
      type: 'group',
      id: ug.group.id,
      label: ug.group.name,
      groupId: ug.group.id,
      groupName: ug.group.name,
    });
    dataPointsUsed++;
  }

  // 1. BALANCE CONTEXT
  if (intent === 'balance' || intent === 'general' || intent === 'group') {
    contextParts.push(`\nAUTHORITATIVE LIVE BALANCES (from Balance Engine - NEVER override these figures):`);

    for (const ug of userGroups) {
      const gid = ug.group.id;
      const gname = ug.group.name;
      const [balanceSummary, pairwiseDebts, members] = await Promise.all([
        getUserBalanceSummary(gid, user.id),
        getPairwiseDebts(gid),
        listGroupMembers(gid),
      ]);

      const memberMap = new Map<string, string>();
      for (const m of members) {
        memberMap.set(m.user.id, m.user.fullName);
      }

      contextParts.push(`\nGroup: "${gname}":`);
      contextParts.push(`  - Net Position: ${balanceSummary.netBalancePaise >= 0 ? '+' : ''}${formatPaise(balanceSummary.netBalancePaise)}`);
      contextParts.push(`  - You Need To Pay Total: ${formatPaise(balanceSummary.youNeedToPayTotalPaise)}`);
      contextParts.push(`  - You Will Receive Total: ${formatPaise(balanceSummary.youWillReceiveTotalPaise)}`);

      if (balanceSummary.youNeedToPay.length > 0) {
        contextParts.push(`  - Debts you owe to others:`);
        for (const debt of balanceSummary.youNeedToPay) {
          const creditorName = memberMap.get(debt.userId) || 'A group member';
          contextParts.push(`    * You owe ${creditorName}: ${formatPaise(debt.amountPaise)}`);
          dataPointsUsed++;
          sources.push({
            type: 'member',
            id: debt.userId,
            label: `${creditorName} (Owed ${formatPaise(debt.amountPaise)})`,
            groupId: gid,
            groupName: gname,
          });
        }
      } else {
        contextParts.push(`  - You do not owe anyone in this group.`);
      }

      if (balanceSummary.youWillReceive.length > 0) {
        contextParts.push(`  - Debts others owe to you:`);
        for (const debt of balanceSummary.youWillReceive) {
          const debtorName = memberMap.get(debt.userId) || 'A group member';
          contextParts.push(`    * ${debtorName} owes you: ${formatPaise(debt.amountPaise)}`);
          dataPointsUsed++;
          sources.push({
            type: 'member',
            id: debt.userId,
            label: `${debtorName} (Owes you ${formatPaise(debt.amountPaise)})`,
            groupId: gid,
            groupName: gname,
          });
        }
      } else {
        contextParts.push(`  - Nobody owes you money in this group.`);
      }

      // If user is asking why they owe someone or about specific pairs, check pairwise breakdown
      if (pairwiseDebts.length > 0) {
        dataPointsUsed += pairwiseDebts.length;
      }
    }
  }

  // 2. EXPENSE CONTEXT
  if (intent === 'expense' || intent === 'balance' || intent === 'general') {
    contextParts.push(`\nRECENT EXPENSES:`);

    for (const ug of userGroups) {
      const gid = ug.group.id;
      const gname = ug.group.name;
      const expenseList = await listExpenses({
        groupId: gid,
        viewerId: user.id,
        limit: 8,
        offset: 0,
      });

      if (expenseList.rows.length > 0) {
        contextParts.push(`\nIn Group "${gname}":`);
        for (const row of expenseList.rows) {
          const payerName = row.payer.id === user.id ? 'You' : row.payer.fullName;
          const myParticipant = row.participants.find((p) => p.userId === user.id);
          const myShare = myParticipant ? formatPaise(myParticipant.sharePaise) : '₹0.00';

          contextParts.push(
            `  - [${row.expense.expenseDate}] "${row.expense.title}" - Total: ${formatPaise(row.expense.amountPaise)} | Paid by: ${payerName} | Category: ${row.expense.category || 'other'} | Your Share: ${myShare}`
          );

          if (row.expense.notes && row.expense.notes.trim()) {
            contextParts.push(`    Notes: "${row.expense.notes.trim()}"`);
          }

          dataPointsUsed++;
          sources.push({
            type: 'expense',
            id: row.expense.id,
            label: `${row.expense.title} — ${formatPaise(row.expense.amountPaise)}`,
            groupId: gid,
            groupName: gname,
          });
        }
      }
    }
  }

  // 3. SETTLEMENT CONTEXT
  if (intent === 'settlement' || intent === 'balance' || intent === 'general') {
    contextParts.push(`\nSETTLEMENTS & PENDING APPROVALS:`);

    for (const ug of userGroups) {
      const gid = ug.group.id;
      const gname = ug.group.name;
      const [settlementList, attention] = await Promise.all([
        listSettlements({ groupId: gid, limit: 6, offset: 0 }),
        getAttentionItems(gid, user.id),
      ]);

      const totalActionable =
        attention.awaitingMyApproval.length +
        attention.awaitingTheirApproval.length +
        attention.rejectedNeedingAction.length;

      if (settlementList.rows.length > 0 || totalActionable > 0) {
        contextParts.push(`\nIn Group "${gname}":`);

        if (totalActionable > 0) {
          contextParts.push(`  - Action Items: ${totalActionable} requiring attention.`);
          if (attention.awaitingMyApproval.length > 0) {
            contextParts.push(`    * Payments awaiting your approval: ${attention.awaitingMyApproval.length}`);
          }
          if (attention.awaitingTheirApproval.length > 0) {
            contextParts.push(`    * Your payments awaiting receiver's approval: ${attention.awaitingTheirApproval.length}`);
          }
          if (attention.rejectedNeedingAction.length > 0) {
            contextParts.push(`    * Rejected payments needing action: ${attention.rejectedNeedingAction.length}`);
          }
        }

        for (const row of settlementList.rows) {
          const s = row.settlement;
          contextParts.push(
            `  - Payment of ${formatPaise(s.amountPaise)} via ${s.paymentMethod.toUpperCase()} | Status: ${s.status} | Date: ${new Date(s.paidAt).toLocaleDateString()}`
          );
          if (s.note) {
            contextParts.push(`    Note: "${s.note}"`);
          }
          if (s.rejectionReason) {
            contextParts.push(`    Rejection Reason: "${s.rejectionReason}"`);
          }

          dataPointsUsed++;
          sources.push({
            type: 'settlement',
            id: s.id,
            label: `Settlement — ${formatPaise(s.amountPaise)} (${s.status})`,
            groupId: gid,
            groupName: gname,
          });
        }
      }
    }
  }

  // 4. ACTIVITY CONTEXT
  if (intent === 'activity') {
    contextParts.push(`\nRECENT GROUP ACTIVITY FEED:`);

    for (const ug of userGroups) {
      const gid = ug.group.id;
      const gname = ug.group.name;
      const activities = await listActivities({ groupId: gid, limit: 6, offset: 0 });

      if (activities.rows.length > 0) {
        contextParts.push(`\nIn Group "${gname}":`);
        for (const act of activities.rows) {
          contextParts.push(
            `  - [${new Date(act.activity.createdAt).toLocaleDateString()}] ${act.actor.fullName} triggered "${act.activity.type}"`
          );
          dataPointsUsed++;
        }
      }
    }
  }

  // 5. SEARCH CONTEXT (if user searches for specific keywords or entities)
  if (intent === 'search' || message.length > 3) {
    const searchTerms = message
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !HINGLISH_MARKERS.has(w.toLowerCase()));

    if (searchTerms.length > 0) {
      const mainTerm = searchTerms[0]!;
      try {
        const searchResults = await search(user.id, mainTerm, 4);

        if (
          searchResults.expenses.length > 0 ||
          searchResults.settlements.length > 0 ||
          searchResults.members.length > 0
        ) {
          contextParts.push(`\nMATCHING SEARCH RESULTS FOR "${mainTerm}":`);

          for (const exp of searchResults.expenses) {
            contextParts.push(`  - Expense: "${exp.title}" (${formatPaise(exp.amountPaise)}) in ${exp.groupName} paid by ${exp.payerName}`);
            sources.push({
              type: 'expense',
              id: exp.id,
              label: `${exp.title} — ${formatPaise(exp.amountPaise)}`,
              groupId: exp.groupId,
              groupName: exp.groupName,
            });
            dataPointsUsed++;
          }

          for (const mem of searchResults.members) {
            contextParts.push(`  - Member: ${mem.fullName} in group "${mem.groupName}"`);
            sources.push({
              type: 'member',
              id: mem.id,
              label: `${mem.fullName} (${mem.groupName})`,
              groupId: mem.groupId,
              groupName: mem.groupName,
            });
            dataPointsUsed++;
          }
        }
      } catch {
        // Best effort search
      }
    }
  }

  // Deduplicate sources by type+id
  const seen = new Set<string>();
  const uniqueSources: AiSource[] = [];
  for (const src of sources) {
    const key = `${src.type}:${src.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueSources.push(src);
    }
  }

  return {
    contextText: contextParts.join('\n'),
    sources: uniqueSources.slice(0, 8),
    dataPointsUsed,
  };
};

/**
 * Builds the comprehensive system instruction for Gemini.
 */
const buildSystemInstruction = (domainContext: string, language: 'en' | 'hinglish'): string => {
  return `You are the SplitWise AI Assistant, a helpful and precise financial companion for shared living expenses and group finances.

MISSION:
Help the authenticated user clearly understand their group expenses, live debts, who owes whom, settlements, pending approvals, and activity.

CRITICAL FINANCIAL RULES:
1. NEVER fabricate, hallucinate, or estimate any financial information or balances.
2. The provided APPLICATION CONTEXT below is the authoritative, ground-truth data from our database ledger.
3. Every balance and paisa calculation in the context is mathematically verified by PostgreSQL. Present these figures with complete confidence.
4. All monetary values are in Indian Rupees (₹). Always format currency with two decimal places (e.g. ₹1,850.00, ₹500.00).
5. Debts in SplitWise are directional and pairwise: if A owes B ₹500, state that clearly without confusing who pays whom.
6. If the user has zero debts or no expenses matching their question, state that directly and reassuringly.
7. You are strictly a READ-ONLY assistant. You cannot create, modify, delete, or approve expenses or settlements.

LANGUAGE & TONE:
1. Detected query language: ${language === 'hinglish' ? 'Hinglish (Hindi written in Roman script)' : 'English'}.
2. Always respond in the EXACT language and natural style used by the user:
   - If the user asks in Hinglish (e.g. "Rahul ko kitna dena hai?", "Mera balance kitna hai?"), answer in natural, friendly Hinglish (e.g. "Aapko Rahul ko kul ₹1,850.00 dene hain...").
   - If the user asks in English, respond in professional, friendly English.
3. Be concise, direct, and structured (use bullet points when explaining multiple obligations or expenses).
4. Never expose internal database IDs (UUIDs) in your response. Refer to people by their full names and expenses by their titles.
5. Never expose secrets, hashed tokens, passwords, or internal database table names.

VERIFIED APPLICATION CONTEXT:
==================================================
${domainContext}
==================================================`;
};

/**
 * Deterministic, verified fallback synthesizer when Gemini API key is missing
 * or Gemini provider is unreachable.
 * Ensures the assistant NEVER breaks and is always data-grounded!
 */
const generateDeterministicFallback = (
  intent: ClassifiedIntent,
  domainContext: string,
  user: User,
  language: 'en' | 'hinglish',
): string => {
  if (language === 'hinglish') {
    if (domainContext.includes('does not belong to any groups yet')) {
      return `Aap abhi kisi bhi group ke member nahi hain. Jab aap koi group create ya join karenge, tab aapka balance aur hisab-kitab yahan show hoga!`;
    }
    if (intent === 'balance') {
      return `Ye raha aapka live balance hisab:\n\n${domainContext.split('\nAUTHORITATIVE LIVE BALANCES')[1]?.split('\nRECENT EXPENSES')[0]?.trim() || 'Aapka koi outstanding balance nahi hai.'}\n\nSabhi balances verified aur live ledger par grounded hain.`;
    }
    if (intent === 'expense') {
      return `Aapke groups ke haliya expenses:\n\n${domainContext.split('\nRECENT EXPENSES:')[1]?.split('\nSETTLEMENTS')[0]?.trim() || 'Koi haliya expense nahi mila.'}`;
    }
    return `Namaste ${user.fullName}! Main aapka SplitWise Assistant hoon. Aap apne live balances, recent expenses, pending settlements ya kisi member ke hisab ke baare mein mujhse pooch sakte hain.`;
  }

  // English fallback
  if (domainContext.includes('does not belong to any groups yet')) {
    return `You do not belong to any groups yet. Once you create or join a group, your live balances and shared expenses will appear here.`;
  }

  if (intent === 'balance') {
    const balSection = domainContext.split('\nAUTHORITATIVE LIVE BALANCES')[1]?.split('\nRECENT EXPENSES')[0]?.trim();
    return `Here is your authoritative live balance summary:\n\n${balSection || 'You currently have no outstanding debts in either direction.'}`;
  }

  if (intent === 'expense') {
    const expSection = domainContext.split('\nRECENT EXPENSES:')[1]?.split('\nSETTLEMENTS')[0]?.trim();
    return `Here are your recent group expenses:\n\n${expSection || 'No recent expenses recorded.'}`;
  }

  return `Hello ${user.fullName}! I am your SplitWise AI Assistant. You can ask me about how much you owe, who owes you, recent group expenses, or pending settlements across your groups.`;
};

/**
 * Main AI Chat service entry point.
 */
export const chatWithAi = async (input: ChatServiceInput): Promise<AiChatResult> => {
  const startTime = Date.now();
  const { user, message, history, signal } = input;

  const language = detectLanguage(message);
  const intent = classifyIntent(message, history);

  // Retrieve strictly authorized domain data from PostgreSQL services
  const { contextText, sources, dataPointsUsed } = await buildDomainContext(
    user,
    intent,
    message,
  );

  const systemInstruction = buildSystemInstruction(contextText, language);

  let answer: string;
  let tokensUsed: number | undefined;

  if (isGeminiConfigured()) {
    try {
      const geminiResult = await callGemini({
        systemInstruction,
        history,
        message,
        signal,
      });

      answer = geminiResult.text;
      tokensUsed = geminiResult.tokensUsed;
    } catch (err: unknown) {
      if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
        throw err;
      }

      logger.warn('ai.gemini_fallback', {
        reason: err instanceof Error ? err.message : String(err),
      });

      // Graceful fallback to verified PostgreSQL data synthesis
      answer = generateDeterministicFallback(intent, contextText, user, language);
    }
  } else {
    // When GEMINI_API_KEY is not configured yet, answer safely from real DB data
    answer = generateDeterministicFallback(intent, contextText, user, language);
  }

  const latencyMs = Date.now() - startTime;

  return {
    answer,
    sources,
    intent,
    language,
    metadata: {
      tokensUsed,
      latencyMs,
      dataPointsUsed,
    },
  };
};
