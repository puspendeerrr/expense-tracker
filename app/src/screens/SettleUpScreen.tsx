import { useCallback, useRef, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { settlements as settlementsApi } from '@/api/endpoints';
import { ApiError, describeError } from '@/api/errors';
import type { Outstanding, PaymentMode } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useGroup, useMemberLookup } from '@/features/group/GroupContext';
import { useAuth } from '@/auth/AuthProvider';
import { Avatar, Card, CardSkeleton, OptionRow, SectionHeader } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { ReceiptField } from '@/components/ReceiptField';
import { Sheet } from '@/components/Sheet';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { formatPaise, paiseToRupees } from '@/lib/money';

/**
 * Record a payment to someone.
 *
 * 1. Opening a UPI app does not settle anything. Android hands control to the payment app
 *    and tells us nothing about outcome. Marking debt cleared upon link opening would risk
 *    fictional payments in the ledger. Opening the app and recording payment remain separate.
 * 2. Amount shown is an advisory ceiling; the backend enforces live balances atomically.
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

  // Choosing who to pay comes first if not specified
  if (!receiverId) {
    const owed = live?.peopleIOwe ?? [];
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <Header title="Settle Up" onBack={back} />
        {owed.length === 0 ? (
          <EmptyState
            title="All settled up!"
            message="You do not owe anybody in this group right now."
            action={{ label: 'Back to group', onPress: back }}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.body}>
            <SectionHeader title="Who do you want to pay?" />
            {owed.map((entry) => (
              <Card
                key={entry.user.id}
                onPress={() => setReceiverId(entry.user.id)}
                accessibilityLabel={
                  'Pay ' + entry.user.fullName + ', you owe ' + formatPaise(entry.amountPaise, { compact: true })
                }
              >
                <View style={styles.personRow}>
                  <Avatar name={entry.user.fullName} size={48} />
                  <View style={styles.rowBody}>
                    <Text style={{ color: colors.text, fontSize: typography.body, fontWeight: '700' }}>
                      {entry.user.fullName}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: typography.caption }}>You owe them</Text>
                  </View>
                  <View style={styles.owedCol}>
                    <Text style={{ color: colors.destructive, fontSize: typography.titleSm, fontWeight: '800' }}>
                      {formatPaise(entry.amountPaise, { compact: true })}
                    </Text>
                    <Icon name="forward" size={16} tone="muted" />
                  </View>
                </View>
              </Card>
            ))}
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
      meName={user?.fullName ?? 'Someone'}
      onBack={back}
      onDone={() => {
        void refresh();
        back();
      }}
      onChangePerson={() => setReceiverId(undefined)}
    />
  );
}

/* -------------------------------------------------------------------------- */

type Person = { id: string; fullName: string; upiId?: string | null; qrCodeUrl?: string | null };

function SettleForm({
  groupId,
  receiverId,
  receiver,
  meName,
  onBack,
  onDone,
  onChangePerson,
}: {
  groupId: string;
  receiverId: string;
  receiver: Person;
  meName: string;
  onBack: () => void;
  onDone: () => void;
  onChangePerson: () => void;
}) {
  const { colors } = useTheme();

  const outstanding = useRequest<Outstanding>(
    useCallback(
      (signal: AbortSignal) => settlementsApi.outstanding(groupId, receiverId, signal),
      [groupId, receiverId],
    ),
    [groupId, receiverId],
  );

  const maxPaise = outstanding.data?.maxSettleablePaise ?? 0;

  const [amount, setAmount] = useState('');
  const [seeded, setSeeded] = useState(false);
  const [method, setMethod] = useState<PaymentMode>('upi');
  const [actionType, setActionType] = useState<'payment' | 'will_pay_soon'>('payment');
  const [note, setNote] = useState('');
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'qr' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(undefined);

  const inFlight = useRef(false);

  if (!seeded && outstanding.data && maxPaise > 0) {
    setAmount(String(paiseToRupees(maxPaise)));
    setSeeded(true);
  }

  const amountPaise = (() => {
    const parsed = Number(amount.replace(/,/g, ''));
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : NaN;
  })();

  const tooMuch = Number.isFinite(amountPaise) && amountPaise > maxPaise;
  const proofRequired = actionType === 'payment' && method === 'upi';
  const proofMissing = proofRequired && !proofUrl;
  const valid = Number.isFinite(amountPaise) && amountPaise > 0 && !tooMuch && !proofMissing;

  /** Hand off to UPI app */
  const openUpi = async (): Promise<void> => {
    if (!receiver.upiId) return;
    const url =
      'upi://pay?pa=' +
      encodeURIComponent(receiver.upiId) +
      '&pn=' +
      encodeURIComponent(receiver.fullName) +
      '&am=' +
      encodeURIComponent(String(paiseToRupees(Number.isFinite(amountPaise) ? amountPaise : 0))) +
      '&cu=INR&tn=' +
      encodeURIComponent('SplitMoney from ' + meName);

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('No UPI app found', 'Install a UPI app, or pay another way and record it here.');
        return;
      }
      await Linking.openURL(url);
      Alert.alert(
        'Finish in your UPI app',
        'When the payment has actually gone through, return and record it here. Opening the app does not record the settlement by itself.',
      );
    } catch {
      Alert.alert('Could not open UPI app', 'Pay another way and record it here.');
    }
  };

  const submit = async (): Promise<void> => {
    if (inFlight.current || submitting || !valid) return;

    inFlight.current = true;
    setSubmitting(true);
    setError(undefined);

    try {
      await settlementsApi.create(groupId, {
        receiverId,
        amount: amount.trim(),
        paymentMethod: method,
        actionType,
        proofUrl,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      onDone();
    } catch (caught: unknown) {
      setError(caught);
      if (caught instanceof ApiError && caught.status === 400) void outstanding.refresh();
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const problem = error ? describeError(error) : undefined;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header title={'Settle with ' + receiver.fullName} onBack={onBack} />

      {outstanding.loading && !outstanding.data ? (
        <View style={styles.body}>
          <CardSkeleton rows={4} />
        </View>
      ) : outstanding.error && !outstanding.data ? (
        <ErrorState error={outstanding.error} onRetry={() => void outstanding.refresh()} />
      ) : maxPaise === 0 ? (
        <EmptyState
          title="Nothing outstanding"
          message={'You do not owe ' + receiver.fullName + ' anything in this group.'}
          action={{ label: 'Choose someone else', onPress: onChangePerson }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Receiver Info Card */}
          <Card>
            <View style={styles.personRow}>
              <Avatar name={receiver.fullName} size={52} />
              <View style={styles.rowBody}>
                <Text style={{ color: colors.text, fontSize: typography.titleSm, fontWeight: '700' }}>
                  {receiver.fullName}
                </Text>
                <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                  Total debt: <Text style={{ color: colors.destructive, fontWeight: '700' }}>{formatPaise(maxPaise)}</Text>
                </Text>
              </View>
              <PrimaryButton
                label="Change"
                variant="secondary"
                onPress={onChangePerson}
                style={styles.changeButton}
              />
            </View>
          </Card>

          {/* Amount Card */}
          <Card>
            <SectionHeader title="Amount to Settle" />
            <TextField
              label="Rupees"
              value={amount}
              onChangeText={setAmount}
              error={tooMuch ? 'Exceeds the ' + formatPaise(maxPaise) + ' you owe.' : undefined}
              placeholder="0.00"
              leftIcon="dollar-sign"
              keyboardType="decimal-pad"
              inputMode="decimal"
              editable={!submitting}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={'Use full amount ' + formatPaise(maxPaise)}
              onPress={() => setAmount(String(paiseToRupees(maxPaise)))}
              style={[styles.fullAmountPill, { backgroundColor: colors.primarySubtle, borderColor: colors.primary }]}
            >
              <Icon name="check" size={14} tone="primary" />
              <Text style={{ color: colors.primary, fontSize: typography.caption, fontWeight: '700' }}>
                {'Settle Full Amount (' + formatPaise(maxPaise) + ')'}
              </Text>
            </Pressable>
          </Card>

          {/* Action Type Selector */}
          <Card>
            <SectionHeader title="Record Type" />
            <OptionRow
              label="I have paid"
              detail="Transfers money and waits for their confirmation. Moves balance once confirmed."
              selected={actionType === 'payment'}
              onPress={() => setActionType('payment')}
            />
            <OptionRow
              label="I will pay soon"
              detail="Records intention to pay. Does not move balance."
              selected={actionType === 'will_pay_soon'}
              onPress={() => setActionType('will_pay_soon')}
            />
          </Card>

          {/* Payment Method Selector */}
          <Card>
            <SectionHeader title="Payment Method" />
            <View style={styles.methodRow}>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: method === 'upi' }}
                onPress={() => setMethod('upi')}
                style={[
                  styles.methodTab,
                  {
                    backgroundColor: method === 'upi' ? colors.primarySubtle : colors.surface,
                    borderColor: method === 'upi' ? colors.primary : colors.border,
                  },
                ]}
              >
                <Icon name="smartphone" size={20} tone={method === 'upi' ? 'primary' : 'muted'} />
                <Text
                  style={[
                    styles.methodLabel,
                    { color: method === 'upi' ? colors.primary : colors.text },
                  ]}
                >
                  UPI
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: method === 'cash' }}
                onPress={() => setMethod('cash')}
                style={[
                  styles.methodTab,
                  {
                    backgroundColor: method === 'cash' ? colors.primarySubtle : colors.surface,
                    borderColor: method === 'cash' ? colors.primary : colors.border,
                  },
                ]}
              >
                <Icon name="credit-card" size={20} tone={method === 'cash' ? 'primary' : 'muted'} />
                <Text
                  style={[
                    styles.methodLabel,
                    { color: method === 'cash' ? colors.primary : colors.text },
                  ]}
                >
                  Cash / Other
                </Text>
              </Pressable>
            </View>
          </Card>

          {/* UPI Integration Section */}
          {method === 'upi' && actionType === 'payment' ? (
            <Card>
              <SectionHeader title="Quick Pay via UPI" />
              <View style={styles.upiButtons}>
                {receiver.upiId ? (
                  <PrimaryButton
                    label="Launch UPI App"
                    icon="external-link"
                    onPress={() => void openUpi()}
                  />
                ) : null}

                {receiver.qrCodeUrl ? (
                  <PrimaryButton
                    label="Show UPI QR Code"
                    icon="camera"
                    variant="secondary"
                    onPress={() => setSheet('qr')}
                  />
                ) : null}

                {!receiver.upiId && !receiver.qrCodeUrl ? (
                  <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                    {receiver.fullName} has not added a UPI ID or QR code to their profile.
                  </Text>
                ) : null}
              </View>

              <Text style={{ color: colors.muted, fontSize: typography.caption, lineHeight: 18 }}>
                Paying in another app does not record anything here. Return and submit payment proof below once the transfer is complete.
              </Text>
            </Card>
          ) : null}

          {/* Proof of Payment */}
          {actionType === 'payment' ? (
            <Card>
              <SectionHeader title={proofRequired ? 'Payment Proof (Required for UPI)' : 'Payment Proof'} />
              <ReceiptField
                label="Screenshot / Transaction Proof"
                url={proofUrl}
                onChange={setProofUrl}
                folder="splitwise/proofs"
              />
              {proofMissing ? (
                <View style={[styles.warnBanner, { backgroundColor: colors.subtle, borderColor: colors.destructive }]}>
                  <Icon name="alert-circle" size={16} tone="destructive" />
                  <Text style={{ color: colors.destructive, fontSize: typography.caption, flex: 1 }}>
                    A screenshot is required for UPI settlements so the recipient can verify payment before confirming.
                  </Text>
                </View>
              ) : null}
            </Card>
          ) : null}

          {/* Optional Note */}
          <Card>
            <TextField
              label="Note (Optional)"
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Sent via Google Pay"
              leftIcon="file-text"
              maxLength={300}
              editable={!submitting}
            />
          </Card>

          {/* Error Banner */}
          {problem ? (
            <View style={[styles.warnBanner, { backgroundColor: colors.subtle, borderColor: colors.destructive }]}>
              <Icon name="alert-circle" size={18} tone="destructive" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.destructive, fontSize: typography.caption, fontWeight: '700' }}>
                  {problem.title}
                </Text>
                <Text style={{ color: colors.muted, fontSize: typography.caption, lineHeight: 18 }}>
                  {problem.message}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Action CTA */}
          <PrimaryButton
            label={actionType === 'will_pay_soon' ? 'Record Promise to Pay' : 'Record Settlement'}
            loading={submitting}
            disabled={!valid}
            onPress={() => void submit()}
          />

          <Text style={{ color: colors.muted, fontSize: typography.caption, textAlign: 'center', lineHeight: 18 }}>
            {actionType === 'will_pay_soon'
              ? 'Notifies them to expect payment. Ledger balance is unaffected.'
              : receiver.fullName + ' will be asked to confirm receipt before the balance updates.'}
          </Text>
        </ScrollView>
      )}

      {/* QR Code Sheet */}
      <Sheet visible={sheet === 'qr'} onClose={() => setSheet(null)} title={receiver.fullName + "'s QR Code"}>
        {receiver.qrCodeUrl ? (
          <View style={styles.qrContainer}>
            <Image
              source={{ uri: receiver.qrCodeUrl }}
              style={styles.qr}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
              accessibilityLabel={'UPI QR Code for ' + receiver.fullName}
            />
            <Text style={{ color: colors.muted, fontSize: typography.caption, textAlign: 'center' }}>
              Scan this in any UPI app, then come back and record the payment.
            </Text>
          </View>
        ) : null}
      </Sheet>
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={10} style={styles.backButton}>
        <Icon name="back" size={20} tone="primary" />
      </Pressable>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={{ color: colors.text, fontSize: typography.titleSm, fontWeight: '800' }}
      >
        {title}
      </Text>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { width: 36 },
  body: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 1.5,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  owedCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  changeButton: {
    minHeight: 34,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
  },
  fullAmountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  methodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  methodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  methodLabel: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  upiButtons: {
    gap: spacing.sm,
  },
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  qrContainer: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  qr: {
    width: 260,
    height: 260,
    borderRadius: radius.md,
  },
});
