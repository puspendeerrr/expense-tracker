import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { settlements as settlementsApi } from '@/api/endpoints';
import { ApiError, NetworkError, describeError } from '@/api/errors';
import type { Outstanding, PaymentMode, Settlement } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useGroup, useMemberLookup } from '@/features/group/GroupContext';
import { buildUpiUri } from '@/features/group/upi';
import { findJustRecorded, pendingTo } from '@/features/group/settlementSafety';
import { useAuth } from '@/auth/AuthProvider';
import {
  SMAmountInput,
  SMAvatar,
  SMButton,
  SMCard,
  SMChoiceCard,
  SMEmptyState,
  SMErrorState,
  SMImagePicker,
  SMImageViewer,
  SMInlineNotice,
  SMPersonBalanceRow,
  SMRowSkeleton,
  SMScreenHeader,
  SMSettlementStatus,
  SMTextInput,
} from '@/components/sm';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';
import { formatPaise, paiseToRupees } from '@/lib/money';

/**
 * Settle up with one person.
 *
 * Three things this screen keeps apart, because they are different financial facts:
 *
 *   INTENT     "I'll pay soon" records a promise. No money has moved and no balance changes.
 *   PAYMENT    "I've paid" records a payment the receiver must still confirm.
 *   EVIDENCE   For UPI, a screenshot of the completed transfer. The server requires it.
 *
 * Opening a UPI app is none of these. Android hands over to the payment app and reports
 * nothing back, so the link is presented as "Open UPI app", never as "Pay", and the screen
 * then asks for proof. Nothing here marks a payment complete — only the receiver's
 * confirmation on the server does that, and only then does a balance move.
 *
 * All amounts shown come from the server (`maxSettleablePaise`, `peopleIOwe`). The ceiling
 * is advisory; the server re-checks it against the live balance when the payment is made.
 */
export default function SettleUpScreen() {
  const { colors } = useTheme();
  const { groupId, live, refresh } = useGroup();
  const lookup = useMemberLookup();
  const { user } = useAuth();
  const router = useRouter();
  const { to } = useLocalSearchParams<{ to?: string }>();

  const [receiverId, setReceiverId] = useState<string | undefined>(to);

  const back = (): void =>
    router.canGoBack() ? router.back() : router.replace(('/group/' + groupId) as never);

  if (!receiverId) {
    // Eligibility is the server's list of people the viewer owes — not a client calculation.
    const owed = live?.peopleIOwe ?? [];
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <SMScreenHeader title="Settle up" onBack={back} />
        {!live ? (
          <View style={styles.body}>
            <SMRowSkeleton rows={3} />
          </View>
        ) : owed.length === 0 ? (
          <SMEmptyState
            icon="checkCircle"
            title="You're all settled up"
            description="You don't owe anyone in this group right now."
            primaryAction={{ label: 'Back to group', onPress: back }}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.body}>
            <Text accessibilityRole="header" style={[styles.pickTitle, { color: colors.text }]}>
              Who are you paying?
            </Text>
            <Text style={[styles.pickHint, { color: colors.muted }]}>
              Only people you currently owe are listed.
            </Text>
            <View style={styles.rows}>
              {owed.map((entry) => (
                <SMPersonBalanceRow
                  key={entry.user.id}
                  name={entry.user.fullName}
                  amount={formatPaise(entry.amountPaise, { compact: true })}
                  direction="i_owe"
                  onPress={() => setReceiverId(entry.user.id)}
                />
              ))}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SettleForm
      key={receiverId}
      groupId={groupId}
      receiverId={receiverId}
      receiver={lookup(receiverId)}
      meId={user?.id ?? ''}
      meName={user?.fullName ?? 'Someone'}
      onBack={back}
      onFinished={() => {
        void refresh();
        back();
      }}
      onViewSettlement={(id) => {
        void refresh();
        router.replace(('/group/' + groupId + '/settlement/' + id) as never);
      }}
      onChangePerson={to ? undefined : () => setReceiverId(undefined)}
    />
  );
}

/* -------------------------------------------------------------------------- */

type Person = { id: string; fullName: string; upiId?: string | null; qrCodeUrl?: string | null };

type UpiState = 'idle' | 'opened' | 'unavailable' | 'failed';

function SettleForm({
  groupId,
  receiverId,
  receiver,
  meId,
  meName,
  onBack,
  onFinished,
  onViewSettlement,
  onChangePerson,
}: {
  groupId: string;
  receiverId: string;
  receiver: Person;
  meId: string;
  meName: string;
  onBack: () => void;
  onFinished: () => void;
  onViewSettlement: (id: string) => void;
  onChangePerson: (() => void) | undefined;
}) {
  const { colors, dark } = useTheme();

  const outstanding = useRequest<Outstanding>(
    useCallback(
      (signal: AbortSignal) => settlementsApi.outstanding(groupId, receiverId, signal),
      [groupId, receiverId],
    ),
    [groupId, receiverId],
  );

  // Payments to this person still waiting on them — a reminder before sending another.
  const waiting = useRequest<Settlement[]>(
    useCallback(
      (signal: AbortSignal) => pendingTo(groupId, meId, receiverId, signal),
      [groupId, meId, receiverId],
    ),
    [groupId, meId, receiverId],
  );

  const maxPaise = outstanding.data?.maxSettleablePaise ?? 0;

  const [amount, setAmount] = useState('');
  const [seeded, setSeeded] = useState(false);
  const [method, setMethod] = useState<PaymentMode>('upi');
  const [actionType, setActionType] = useState<'payment' | 'will_pay_soon'>('payment');
  const [note, setNote] = useState('');
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [upi, setUpi] = useState<UpiState>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [uncertain, setUncertain] = useState(false);
  const [recorded, setRecorded] = useState<Settlement | null>(null);

  const inFlight = useRef(false);

  // Start from the whole amount owed, straight from the server.
  if (!seeded && outstanding.data && maxPaise > 0) {
    setAmount(String(paiseToRupees(maxPaise)));
    setSeeded(true);
  }

  const amountPaise = (() => {
    const parsed = Number(amount.replace(/,/g, ''));
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : NaN;
  })();

  const tooMuch = Number.isFinite(amountPaise) && amountPaise > maxPaise;
  const promise = actionType === 'will_pay_soon';
  const proofRequired = !promise && method === 'upi';
  const proofMissing = proofRequired && !proofUrl;
  const valid = Number.isFinite(amountPaise) && amountPaise > 0 && !tooMuch && !proofMissing;

  const openUpi = async (): Promise<void> => {
    if (!receiver.upiId) return;
    const url = buildUpiUri({
      upiId: receiver.upiId,
      payeeName: receiver.fullName,
      amountPaise,
      payerName: meName,
    });

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        setUpi('unavailable');
        return;
      }
      await Linking.openURL(url);
      // Opened is all we know. Whether money moved is only shown by the screenshot.
      setUpi('opened');
    } catch {
      setUpi('failed');
    }
  };

  const submit = async (): Promise<void> => {
    if (inFlight.current || submitting || checking || !valid) return;

    inFlight.current = true;
    setSubmitting(true);
    setError(undefined);
    setUncertain(false);

    try {
      const { settlement } = await settlementsApi.create(groupId, {
        receiverId,
        amount: amount.trim(),
        paymentMethod: method,
        actionType,
        proofUrl,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setRecorded(settlement);
    } catch (caught: unknown) {
      if (caught instanceof NetworkError) {
        /*
         * The request may have reached the server before the connection failed. Look
         * before offering a retry: if the settlement is there, this submission worked.
         */
        setChecking(true);
        try {
          const found = await findJustRecorded(groupId, {
            payerId: meId,
            receiverId,
            amountPaise,
            status: promise ? 'will_pay_soon' : 'paid_pending_approval',
          });
          if (found) {
            setRecorded(found);
          } else {
            setError(caught);
          }
        } catch {
          // Could not even check. Say so plainly rather than inviting a blind retry.
          setUncertain(true);
          setError(caught);
        } finally {
          setChecking(false);
        }
      } else {
        setError(caught);
        if (caught instanceof ApiError && caught.status === 400) void outstanding.refresh();
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  /* ---- After a successful submission: say exactly what happened ---- */

  if (recorded) {
    const isPromise = recorded.status === 'will_pay_soon';
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
        <SMScreenHeader title={isPromise ? 'Promise sent' : 'Payment recorded'} onBack={onFinished} variant="close" />
        <ScrollView contentContainerStyle={styles.doneBody}>
          <View style={[styles.doneIcon, { backgroundColor: isPromise ? colors.infoLight : colors.warningLight }]}>
            <Icon name={isPromise ? 'calendar' : 'clock'} size={30} color={isPromise ? colors.info : colors.warning} />
          </View>

          <Text accessibilityRole="header" style={[styles.doneTitle, { color: colors.text }]}>
            {isPromise ? 'You told ' + receiver.fullName + ' you’ll pay' : 'Payment submitted'}
          </Text>

          <Text
            style={[styles.doneAmount, { color: colors.text }]}
            accessibilityLabel={formatPaise(recorded.amountPaise) + (isPromise ? ' promised to ' : ' to ') + receiver.fullName}
          >
            {formatPaise(recorded.amountPaise)}
          </Text>

          <SMSettlementStatus status={recorded.status} size="md" />

          <Text style={[styles.doneText, { color: colors.muted }]}>
            {isPromise
              ? 'No money has moved and your balance is unchanged. ' +
                receiver.fullName +
                ' can see that you intend to pay.'
              : 'Waiting for ' +
                receiver.fullName +
                ' to confirm it. Your balance with them changes only once they do.'}
          </Text>

          <View style={styles.doneActions}>
            <SMButton label="Done" variant="primary" fullWidth onPress={onFinished} />
            <SMButton
              label="View settlement"
              variant="secondary"
              fullWidth
              onPress={() => onViewSettlement(recorded.id)}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const problem = error ? describeError(error) : undefined;
  const pendingAlready = waiting.data ?? [];

  const primaryLabel = promise
    ? 'Send promise'
    : method === 'cash'
      ? 'Record cash payment'
      : 'Submit payment';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
      <SMScreenHeader title="Settle up" subtitle={receiver.fullName} onBack={onBack} />

      {outstanding.loading && !outstanding.data ? (
        <View style={styles.body}>
          <SMRowSkeleton rows={4} />
        </View>
      ) : outstanding.error && !outstanding.data ? (
        <SMErrorState error={outstanding.error} onRetry={() => void outstanding.refresh()} />
      ) : maxPaise === 0 ? (
        <SMEmptyState
          icon="checkCircle"
          title="Nothing to settle"
          description={'You don’t owe ' + receiver.fullName + ' anything in this group.'}
          primaryAction={
            onChangePerson
              ? { label: 'Choose someone else', onPress: onChangePerson }
              : { label: 'Back', onPress: onBack }
          }
        />
      ) : (
        <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {/* ---- Who, and what the server says is owed ---- */}
            <SMCard style={styles.who}>
              <SMAvatar name={receiver.fullName} size={52} round />
              <View style={styles.whoBody}>
                <Text numberOfLines={1} style={[styles.whoName, { color: colors.text }]}>
                  {receiver.fullName}
                </Text>
                <Text
                  style={[styles.whoOwe, { color: colors.muted }]}
                  accessibilityLabel={'You owe ' + receiver.fullName + ' ' + formatPaise(maxPaise)}
                >
                  {'You owe '}
                  <Text style={[styles.whoAmount, { color: colors.destructive }]}>{formatPaise(maxPaise)}</Text>
                </Text>
              </View>
              {onChangePerson ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Pay someone else"
                  onPress={onChangePerson}
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <Text style={[styles.change, { color: colors.primary }]}>Change</Text>
                </Pressable>
              ) : null}
            </SMCard>

            {pendingAlready.length > 0 ? (
              <SMInlineNotice
                type="warning"
                title={
                  pendingAlready.length === 1
                    ? 'You already have a payment waiting'
                    : pendingAlready.length + ' payments are already waiting'
                }
                message={
                  pendingAlready.map((s) => formatPaise(s.amountPaise)).join(', ') +
                  ' to ' +
                  receiver.fullName +
                  ' is still waiting for them to confirm. Only record another if it is a separate payment.'
                }
              />
            ) : null}

            {/* ---- Have you paid, or are you promising to? ---- */}
            <Section title="What are you recording?">
              <SMChoiceCard
                icon="checkCircle"
                title="I’ve paid"
                description={receiver.fullName + ' will be asked to confirm they received it.'}
                selected={!promise}
                onPress={() => setActionType('payment')}
              />
              <SMChoiceCard
                icon="calendar"
                title="I’ll pay soon"
                description="Just lets them know. No money moves and your balance doesn’t change."
                selected={promise}
                onPress={() => setActionType('will_pay_soon')}
              />
            </Section>

            {/* ---- How much ---- */}
            <Section title={promise ? 'How much will you pay?' : 'How much did you pay?'}>
              <SMAmountInput
                label="Amount"
                value={amount}
                onChangeText={setAmount}
                {...(tooMuch ? { error: 'That’s more than the ' + formatPaise(maxPaise) + ' you owe.' } : {})}
                {...(Number.isFinite(amountPaise) && amountPaise > 0 && !tooMuch
                  ? { confirmation: formatPaise(amountPaise) + (amountPaise < maxPaise ? ' of ' + formatPaise(maxPaise) : '') }
                  : {})}
                editable={!submitting}
              />
              {Number.isFinite(amountPaise) && amountPaise !== maxPaise ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={'Use the full amount, ' + formatPaise(maxPaise)}
                  onPress={() => setAmount(String(paiseToRupees(maxPaise)))}
                  hitSlop={8}
                  style={({ pressed }) => [styles.fullAmount, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={[styles.fullAmountText, { color: colors.primary }]}>
                    {'Pay the full ' + formatPaise(maxPaise)}
                  </Text>
                </Pressable>
              ) : null}
            </Section>

            {/* ---- How ---- */}
            <Section title={promise ? 'How will you pay?' : 'How did you pay?'}>
              <SMChoiceCard
                icon="smartphone"
                title="UPI"
                description={promise ? 'Google Pay, PhonePe, Paytm or any UPI app' : 'A screenshot of the payment is required'}
                selected={method === 'upi'}
                onPress={() => setMethod('upi')}
              />
              <SMChoiceCard
                icon="money"
                title="Cash"
                description={promise ? 'In person' : 'No screenshot needed'}
                selected={method === 'cash'}
                onPress={() => setMethod('cash')}
              />
            </Section>

            {/* ---- UPI hand-off: opening the app is not the payment ---- */}
            {method === 'upi' && !promise ? (
              <Section title="Pay with your UPI app">
                {receiver.upiId ? (
                  <SMCard style={styles.upiCard}>
                    <View style={styles.upiRow}>
                      <Icon name="smartphone" size={16} tone="primary" />
                      <Text numberOfLines={1} style={[styles.upiId, { color: colors.text }]} selectable>
                        {receiver.upiId}
                      </Text>
                    </View>
                    <SMButton
                      label={'Open UPI app · ' + (Number.isFinite(amountPaise) ? formatPaise(amountPaise) : '')}
                      icon="send"
                      variant="secondary"
                      fullWidth
                      disabled={!Number.isFinite(amountPaise) || amountPaise <= 0 || tooMuch}
                      onPress={() => void openUpi()}
                      accessibilityHint="Opens your UPI app. It does not record the payment in SplitMoney."
                    />
                    <Text style={[styles.upiNote, { color: colors.muted }]}>
                      Opening your UPI app doesn’t record anything here. After you’ve paid, come back and
                      add the screenshot below.
                    </Text>
                  </SMCard>
                ) : (
                  <SMInlineNotice
                    type="info"
                    message={
                      receiver.fullName +
                      ' hasn’t added a UPI ID.' +
                      (receiver.qrCodeUrl ? ' You can scan their QR code instead.' : ' Pay them another way, then record it here.')
                    }
                  />
                )}

                {receiver.qrCodeUrl ? (
                  <SMButton
                    label="Show their UPI QR code"
                    icon="maximize"
                    variant="ghost"
                    onPress={() => setQrOpen(true)}
                  />
                ) : null}

                {upi === 'opened' ? (
                  <SMInlineNotice
                    type="info"
                    title="Back from your UPI app?"
                    message="If the payment went through, add its screenshot below and submit. If it didn’t, nothing has been recorded."
                  />
                ) : upi === 'unavailable' ? (
                  <SMInlineNotice
                    type="warning"
                    message="No UPI app was found on this phone. Pay another way, then record it here."
                  />
                ) : upi === 'failed' ? (
                  <SMInlineNotice
                    type="warning"
                    message="Your UPI app couldn’t be opened. Pay another way, then record it here."
                  />
                ) : null}
              </Section>
            ) : null}

            {/* ---- Evidence ---- */}
            {!promise ? (
              <Section title="Payment proof" hint={proofRequired ? 'Required for UPI' : 'Optional'}>
                <SMImagePicker
                  variant="receipt"
                  label="Screenshot of the payment"
                  url={proofUrl}
                  folder="splitwise/proofs"
                  onChange={(image) => setProofUrl(image ? image.url : null)}
                  disabled={submitting}
                  helperText={
                    proofRequired
                      ? 'The confirmation screen from your UPI app, showing the amount and that it succeeded.'
                      : 'A photo of a receipt, if you have one.'
                  }
                />
              </Section>
            ) : null}

            <Section title="Note" hint="Optional">
              <SMTextInput
                label="Note"
                value={note}
                onChangeText={setNote}
                placeholder={promise ? 'e.g. I’ll pay on Friday' : 'e.g. Sent from my HDFC account'}
                maxLength={300}
                editable={!submitting}
              />
            </Section>

            {problem ? (
              <SMInlineNotice
                type="error"
                title={uncertain ? 'We couldn’t confirm whether this was recorded' : problem.title}
                message={
                  uncertain
                    ? 'The connection dropped and we couldn’t check. Look at this group’s settlements before trying again, so it isn’t recorded twice.'
                    : problem.message
                }
              />
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.footer,
              { backgroundColor: colors.background, borderTopColor: dark ? colors.borderStrong : colors.border },
            ]}
          >
            {proofMissing ? (
              <Text style={[styles.footerHint, { color: colors.muted }]}>
                Add the payment screenshot to submit.
              </Text>
            ) : null}
            <SMButton
              label={primaryLabel}
              loadingLabel={checking ? 'Checking…' : 'Recording…'}
              variant="primary"
              fullWidth
              loading={submitting || checking}
              disabled={!valid}
              onPress={() => void submit()}
            />
          </View>
        </KeyboardAvoidingView>
      )}

      <SMImageViewer
        visible={qrOpen}
        uri={receiver.qrCodeUrl ?? null}
        title={receiver.fullName + '’s UPI QR code'}
        onClose={() => setQrOpen(false)}
      />
    </SafeAreaView>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.muted }]}>
          {title}
        </Text>
        {hint ? <Text style={[styles.sectionHint, { color: colors.muted }]}>{hint}</Text> : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: spacing.base, gap: spacing.lg, paddingBottom: spacing.xxl },
  rows: { gap: spacing.sm },
  pickTitle: { fontSize: typography.titleSm, fontWeight: '800' },
  pickHint: { fontSize: typography.caption, marginTop: -spacing.md },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.base },
  whoBody: { flex: 1, gap: 2 },
  whoName: { fontSize: typography.body, fontWeight: '800' },
  whoOwe: { fontSize: typography.bodySm },
  whoAmount: { fontWeight: '800', fontVariant: ['tabular-nums'] },
  change: { fontSize: typography.caption, fontWeight: '700' },
  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { fontSize: typography.xs, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  sectionHint: { fontSize: typography.xs, fontWeight: '600' },
  sectionBody: { gap: spacing.sm },
  fullAmount: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  fullAmountText: { fontSize: typography.caption, fontWeight: '700' },
  upiCard: { padding: spacing.base, gap: spacing.md },
  upiRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  upiId: { flex: 1, fontSize: typography.bodySm, fontWeight: '600' },
  upiNote: { fontSize: typography.caption, lineHeight: 18 },
  footer: { paddingHorizontal: spacing.base, paddingVertical: spacing.md, borderTopWidth: 1, gap: spacing.xs },
  footerHint: { fontSize: typography.caption, textAlign: 'center' },
  doneBody: { padding: spacing.lg, alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxl },
  doneIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontSize: typography.title, fontWeight: '800', textAlign: 'center' },
  doneAmount: { fontSize: typography.hero, fontWeight: '800', fontVariant: ['tabular-nums'] },
  doneText: { fontSize: typography.bodySm, lineHeight: 21, textAlign: 'center', maxWidth: 320 },
  doneActions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.base },
});
