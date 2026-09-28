import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { settlements as settlementsApi } from '@/api/endpoints';
import { describeError } from '@/api/errors';
import type { Settlement } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useGroup, useMemberLookup } from '@/features/group/GroupContext';
import { settlementActions } from '@/features/group/permissions';
import { loadSettlement } from '@/features/group/settlementSafety';
import { useAuth } from '@/auth/AuthProvider';
import {
  SMButton,
  SMCard,
  SMConfirmSheet,
  SMDetailRow,
  SMEmptyState,
  SMErrorState,
  SMImagePicker,
  SMImageViewer,
  SMInlineNotice,
  SMRowSkeleton,
  SMScreenHeader,
  SMSettlementParties,
  SMSettlementStatus,
  SMSheet,
  SMTextInput,
  SMTimeline,
  type SMTimelineStep,
} from '@/components/sm';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { formatInstant, formatPaise } from '@/lib/money';
import { useAiScreenContext } from '@/ai/useAiScreenContext';

type Sheet = 'approve' | 'reject' | 'cancel' | 'proof' | null;

/**
 * The story of one settlement, and what the viewer can do about it.
 *
 * WHAT IS SHOWN IS WHAT THE SERVER SAYS. Status, dates and amounts all come from the
 * settlement record; nothing is inferred. The timeline only ticks steps that have happened,
 * and only shows dates the record actually holds — rejection, for instance, stores no
 * timestamp, so none is invented for it.
 *
 * WHAT IS OFFERED IS WHAT THE SERVER ALLOWS. Actions come from `settlementActions`, which
 * mirrors the service's own rules; an action the viewer cannot take is not drawn at all.
 *
 * NOTHING HERE MOVES MONEY LOCALLY. After any action the settlement and the group's live
 * balances are re-read from the server. A confirmed payment lowers a balance because the
 * server recomputed it, not because this screen subtracted anything.
 */
export default function SettlementDetailScreen() {
  const { colors, dark } = useTheme();
  const { groupId, revision, refresh } = useGroup();
  const lookup = useMemberLookup();
  const { user } = useAuth();
  const router = useRouter();
  const { settlementId } = useLocalSearchParams<{ settlementId: string }>();

  const [sheet, setSheet] = useState<Sheet>(null);
  const [reason, setReason] = useState('');
  const [newProof, setNewProof] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);

  const request = useRequest<Settlement | null>(
    useCallback(
      (signal: AbortSignal) => loadSettlement(groupId, settlementId, signal),
      [groupId, settlementId],
    ),
    // `revision` ticks on realtime settlement events, so a payer watching this screen sees
    // it become confirmed or rejected without leaving and coming back.
    [groupId, settlementId, revision],
  );

  const settlement = request.data ?? undefined;
  useAiScreenContext(
    'settlement',
    settlement ? formatPaise(settlement.amountPaise) + ' to ' + lookup(settlement.receiverId).fullName : null,
  );
  const back = (): void =>
    router.canGoBack() ? router.back() : router.replace(('/group/' + groupId) as never);

  const open = (next: Sheet): void => {
    setActionError(null);
    setSheet(next);
  };

  /** Runs one action, then re-reads everything the server may have changed. */
  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      setSheet(null);
      setReason('');
      setNewProof(null);
      await Promise.all([request.refresh(), refresh()]);
    } catch (caught: unknown) {
      // The server's sentence, kept in the sheet that asked the question.
      setActionError(describeError(caught).message);
    } finally {
      setBusy(false);
    }
  };

  const header = <SMScreenHeader title="Settlement" onBack={back} />;

  if (request.loading && request.data === undefined) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        {header}
        <View style={styles.body}>
          <SMRowSkeleton rows={4} />
        </View>
      </SafeAreaView>
    );
  }

  if (request.error && request.data === undefined) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        {header}
        <SMErrorState error={request.error} onRetry={() => void request.refresh()} />
      </SafeAreaView>
    );
  }

  if (!settlement) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        {header}
        <SMEmptyState
          icon="settlement"
          title="Settlement not found"
          description="It may belong to another group, or it no longer exists."
          primaryAction={{ label: 'Back to group', onPress: back }}
        />
      </SafeAreaView>
    );
  }

  const payer = lookup(settlement.payerId);
  const receiver = lookup(settlement.receiverId);
  const iAmPayer = settlement.payerId === user?.id;
  const iAmReceiver = settlement.receiverId === user?.id;
  const can = settlementActions(settlement, user?.id);

  const payerName = iAmPayer ? 'You' : payer.fullName;
  const isPromise = settlement.status === 'will_pay_soon';
  const hasReason = Boolean(settlement.rejectionReason && settlement.rejectionReason.trim());

  /** One sentence: where this stands and who, if anyone, has to act. */
  const summary = (() => {
    switch (settlement.status) {
      case 'paid_pending_approval':
        return iAmReceiver
          ? payer.fullName + ' says they paid you. Confirm once you’ve received it.'
          : 'Waiting for ' + receiver.fullName + ' to confirm. The balance changes only once they do.';
      case 'will_pay_soon':
        return payerName + (iAmPayer ? ' have' : ' has') + ' promised to pay. No money has moved and no balance has changed.';
      case 'completed':
        return 'Confirmed. This payment is included in the group’s balances.';
      case 'rejected':
        return iAmPayer
          ? receiver.fullName + ' didn’t confirm this payment. You can send a new screenshot or withdraw it.'
          : 'This payment was rejected, so it doesn’t count toward any balance.';
      case 'cancelled':
        return 'This was cancelled and doesn’t count toward any balance.';
      default:
        return '';
    }
  })();

  const steps = buildTimeline(settlement, payer.fullName, receiver.fullName);

  const cancelLabel = isPromise
    ? iAmReceiver
      ? 'Dismiss promise'
      : 'Cancel promise'
    : 'Withdraw payment';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {header}

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* ---- Who, how much, where it stands ---- */}
        <SMCard style={styles.hero}>
          <SMSettlementParties
            payerName={payer.fullName}
            receiverName={receiver.fullName}
            payerIsMe={iAmPayer}
            receiverIsMe={iAmReceiver}
          />

          <Text
            style={[styles.amount, { color: colors.text }]}
            accessibilityLabel={
              formatPaise(settlement.amountPaise) +
              (isPromise ? ' promised' : ' ') +
              (isPromise ? '' : settlement.paymentMethod === 'upi' ? 'by UPI' : 'in cash')
            }
          >
            {formatPaise(settlement.amountPaise)}
          </Text>

          <Text style={[styles.meta, { color: colors.muted }]}>
            {(isPromise ? 'Promised · ' : '') +
              (settlement.paymentMethod === 'upi' ? 'UPI' : 'Cash') +
              ' · ' +
              formatInstant(settlement.paidAt)}
          </Text>

          <SMSettlementStatus status={settlement.status} size="md" />

          <Text style={[styles.summary, { color: colors.muted }]}>{summary}</Text>
        </SMCard>

        {/* ---- Why it was rejected, where it can be read ---- */}
        {settlement.status === 'rejected' && hasReason ? (
          <SMInlineNotice type="error" title="Reason given" message={settlement.rejectionReason ?? ''} />
        ) : null}

        {/* ---- What the viewer can do ---- */}
        {can.approve || can.reject ? (
          <View style={styles.actions}>
            <SMButton
              label="Confirm I received it"
              icon="checkCircle"
              variant="primary"
              fullWidth
              onPress={() => open('approve')}
            />
            <SMButton
              label="I didn’t receive it"
              icon="close"
              variant="outline"
              fullWidth
              onPress={() => open('reject')}
            />
          </View>
        ) : null}

        {can.replaceProof ? (
          <SMButton
            label={settlement.status === 'rejected' ? 'Send a new screenshot' : 'Replace screenshot'}
            icon="image"
            variant={settlement.status === 'rejected' ? 'primary' : 'secondary'}
            fullWidth
            onPress={() => open('proof')}
          />
        ) : null}

        {/* ---- Proof, shown only because the server returned it to this viewer ---- */}
        {settlement.proofUrl ? (
          <Section title="Payment proof">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View payment screenshot full screen"
              onPress={() => setViewing(true)}
              style={({ pressed }) => [
                styles.proof,
                { borderColor: dark ? colors.borderStrong : colors.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Image
                source={{ uri: settlement.proofUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
              <View style={styles.proofBadge}>
                <Icon name="maximize" size={13} color="#FFFFFF" />
                <Text style={styles.proofBadgeText}>View</Text>
              </View>
            </Pressable>
          </Section>
        ) : null}

        <Section title="What happened">
          <SMCard style={styles.timelineCard}>
            <SMTimeline steps={steps} />
          </SMCard>
        </Section>

        <Section title="Details">
          <SMCard style={styles.details}>
            <SMDetailRow label="Recorded" value={formatInstant(settlement.createdAt)} />
            {settlement.verifiedAt && settlement.status === 'completed' ? (
              <SMDetailRow label="Confirmed" value={formatInstant(settlement.verifiedAt)} />
            ) : null}
            <SMDetailRow label="Method" value={settlement.paymentMethod === 'upi' ? 'UPI' : 'Cash'} />
            {settlement.note ? <SMDetailRow label="Note" value={settlement.note} /> : null}
          </SMCard>
        </Section>

        {can.cancel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Asks for confirmation first"
            onPress={() => open('cancel')}
            hitSlop={8}
            style={({ pressed }) => [styles.cancel, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.cancelText, { color: colors.destructive }]}>{cancelLabel}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* ---- Confirm receipt ---- */}
      <SMConfirmSheet
        visible={sheet === 'approve'}
        onCancel={() => setSheet(null)}
        onConfirm={() => void run(() => settlementsApi.approve(groupId, settlement.id))}
        loading={busy}
        icon="checkCircle"
        title="Confirm you received it?"
        description={
          'You’re confirming that ' +
          formatPaise(settlement.amountPaise) +
          ' from ' +
          payer.fullName +
          ' reached you.'
        }
        detail="Once confirmed, the group’s balances are updated to include this payment."
        errorMessage={actionError}
        confirmLabel="Confirm payment"
      />

      {/* ---- Reject, with an optional reason the server stores ---- */}
      <SMSheet
        visible={sheet === 'reject'}
        onClose={() => setSheet(null)}
        title="Didn’t receive it?"
        subtitle={payer.fullName + ' will be told, and can send a new screenshot or withdraw it.'}
        footer={
          <View style={styles.sheetActions}>
            <SMButton
              label="Keep waiting"
              variant="primary"
              fullWidth
              onPress={() => setSheet(null)}
            />
            <SMButton
              label="Reject payment"
              loadingLabel="Rejecting…"
              variant="outline"
              fullWidth
              loading={busy}
              onPress={() =>
                void run(() => settlementsApi.reject(groupId, settlement.id, reason.trim() || undefined))
              }
            />
          </View>
        }
      >
        <View style={styles.sheetBody}>
          <SMTextInput
            label="Reason"
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Nothing arrived in my account"
            helperText="Optional. Shown to them with the rejection."
            maxLength={300}
            multiline
            editable={!busy}
            style={styles.multiline}
          />
          {actionError ? <SMInlineNotice type="error" message={actionError} /> : null}
        </View>
      </SMSheet>

      {/* ---- New proof: the same settlement, back to pending ---- */}
      <SMSheet
        visible={sheet === 'proof'}
        onClose={() => setSheet(null)}
        title={settlement.status === 'rejected' ? 'Send a new screenshot' : 'Replace screenshot'}
        subtitle={'This goes back to ' + receiver.fullName + ' to confirm. It stays the same payment.'}
        footer={
          <SMButton
            label="Send for confirmation"
            loadingLabel="Sending…"
            variant="primary"
            fullWidth
            loading={busy}
            disabled={!newProof}
            onPress={() => {
              if (newProof) void run(() => settlementsApi.reuploadProof(groupId, settlement.id, newProof));
            }}
          />
        }
      >
        <View style={styles.sheetBody}>
          <SMImagePicker
            variant="receipt"
            label="Payment screenshot"
            url={newProof}
            folder="splitwise/proofs"
            onChange={(image) => setNewProof(image ? image.url : null)}
            helperText="The confirmation screen from your UPI app."
          />
          {actionError ? <SMInlineNotice type="error" message={actionError} /> : null}
        </View>
      </SMSheet>

      {/* ---- Cancel / withdraw ---- */}
      <SMConfirmSheet
        visible={sheet === 'cancel'}
        onCancel={() => setSheet(null)}
        onConfirm={() => void run(() => settlementsApi.cancel(groupId, settlement.id))}
        destructive
        loading={busy}
        icon="close"
        title={cancelLabel + '?'}
        description={
          isPromise
            ? 'The promise is removed. It never affected any balance.'
            : 'This payment will be cancelled and won’t count toward any balance.'
        }
        errorMessage={actionError}
        confirmLabel={cancelLabel}
        cancelLabel="Keep it"
      />

      <SMImageViewer
        visible={viewing}
        uri={settlement.proofUrl}
        title="Payment screenshot"
        onClose={() => setViewing(false)}
      />
    </SafeAreaView>
  );
}

/**
 * The timeline, from fields the record actually holds.
 *
 * A promise is shown as a promise with the payment still to come. A payment shows when it
 * was recorded, whether proof is attached (for UPI), and then its one outcome. Future steps
 * are drawn as upcoming, never as done; rejection and cancellation carry no date because
 * the record stores none for them.
 */
function buildTimeline(s: Settlement, payerName: string, receiverName: string): SMTimelineStep[] {
  if (s.status === 'will_pay_soon') {
    return [
      { key: 'promised', label: payerName + ' promised to pay', detail: formatInstant(s.createdAt), state: 'done' },
      { key: 'paid', label: 'Payment', detail: 'Not made yet', state: 'upcoming' },
    ];
  }

  const steps: SMTimelineStep[] = [
    {
      key: 'recorded',
      label: s.status === 'cancelled' ? 'Recorded' : 'Payment recorded',
      detail: formatInstant(s.paidAt),
      state: 'done',
    },
  ];

  if (s.paymentMethod === 'upi' && s.status !== 'cancelled') {
    steps.push({
      key: 'proof',
      label: s.hasProof ? 'Screenshot attached' : 'Screenshot needed',
      state: s.hasProof ? 'done' : 'current',
    });
  }

  switch (s.status) {
    case 'paid_pending_approval':
      steps.push({ key: 'confirm', label: 'Waiting for ' + receiverName + ' to confirm', state: 'current' });
      steps.push({ key: 'balance', label: 'Balance updated', state: 'upcoming' });
      break;
    case 'completed':
      steps.push({
        key: 'confirm',
        label: 'Confirmed by ' + receiverName,
        ...(s.verifiedAt ? { detail: formatInstant(s.verifiedAt) } : {}),
        state: 'done',
      });
      steps.push({ key: 'balance', label: 'Balance updated', state: 'done' });
      break;
    case 'rejected':
      steps.push({
        key: 'confirm',
        label: 'Rejected by ' + receiverName,
        ...(s.rejectionReason && s.rejectionReason.trim() ? { detail: s.rejectionReason } : {}),
        state: 'failed',
      });
      break;
    case 'cancelled':
      steps.push({ key: 'cancelled', label: 'Cancelled', state: 'failed' });
      break;
    default:
      break;
  }

  return steps;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.muted }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: spacing.base, gap: spacing.lg, paddingBottom: spacing.xxl },
  hero: { padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  amount: { fontSize: typography.hero, fontWeight: '800', letterSpacing: -0.8, fontVariant: ['tabular-nums'], marginTop: spacing.sm },
  meta: { fontSize: typography.caption },
  summary: { fontSize: typography.bodySm, lineHeight: 21, textAlign: 'center', marginTop: spacing.xs },
  actions: { gap: spacing.sm },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: typography.xs, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  proof: {
    height: 180,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  proofBadge: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    minHeight: 28,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(15,23,42,0.6)',
  },
  proofBadgeText: { color: '#FFFFFF', fontSize: typography.xs, fontWeight: '700' },
  timelineCard: { padding: spacing.base },
  details: { paddingHorizontal: spacing.base, paddingVertical: spacing.xs },
  cancel: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.base },
  cancelText: { fontSize: typography.bodySm, fontWeight: '700' },
  sheetActions: { gap: spacing.sm },
  sheetBody: { gap: spacing.md },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
});
