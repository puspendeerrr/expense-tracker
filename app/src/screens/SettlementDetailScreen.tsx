import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { settlements as settlementsApi } from '@/api/endpoints';
import { describeError } from '@/api/errors';
import type { Settlement, SettlementListPayload } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useGroup, useMemberLookup } from '@/features/group/GroupContext';
import { useAuth } from '@/auth/AuthProvider';
import { Avatar, Badge, Card, CardSkeleton, DetailRow, SectionHeader } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { ReceiptField } from '@/components/ReceiptField';
import { Sheet } from '@/components/Sheet';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { formatInstant, formatPaise, SETTLEMENT_STATUS_LABELS } from '@/lib/money';

/**
 * Detailed view of one settlement, its full lifecycle history, proof, and actions.
 */
export default function SettlementDetailScreen() {
  const { colors } = useTheme();
  const { groupId, refresh } = useGroup();
  const lookup = useMemberLookup();
  const { user } = useAuth();
  const router = useRouter();
  const { settlementId } = useLocalSearchParams<{ settlementId: string }>();

  const [action, setAction] = useState<'reject' | 'cancel' | 'proof' | null>(null);
  const [reason, setReason] = useState('');
  const [newProof, setNewProof] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewProof, setViewProof] = useState(false);

  const request = useRequest<SettlementListPayload>(
    useCallback(
      (signal: AbortSignal) => settlementsApi.list(groupId, { limit: 100 }, signal),
      [groupId],
    ),
    [groupId, settlementId],
  );

  const settlement = request.data?.settlements.find((s) => s.id === settlementId);

  const back = (): void =>
    router.canGoBack() ? router.back() : router.replace(('/group/' + groupId) as never);

  const run = async (label: string, fn: () => Promise<unknown>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      setAction(null);
      setReason('');
      setNewProof(null);
      await request.refresh();
      void refresh();
    } catch (caught: unknown) {
      Alert.alert('Could not ' + label, describeError(caught).message);
    } finally {
      setBusy(false);
    }
  };

  const payer = settlement ? lookup(settlement.payerId) : undefined;
  const receiver = settlement ? lookup(settlement.receiverId) : undefined;
  const iAmPayer = settlement?.payerId === user?.id;
  const iAmReceiver = settlement?.receiverId === user?.id;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} hitSlop={10} style={styles.backButton}>
          <Icon name="back" size={20} tone="primary" />
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: typography.titleSm, fontWeight: '800' }}
        >
          Settlement Details
        </Text>
        <View style={styles.spacer} />
      </View>

      {request.loading && !request.data ? (
        <View style={styles.body}>
          <CardSkeleton rows={5} />
        </View>
      ) : request.error && !request.data ? (
        <ErrorState error={request.error} onRetry={() => void request.refresh()} />
      ) : !settlement ? (
        <EmptyState
          title="Settlement not found"
          message="It may have been removed or is older than recent loaded history."
          action={{ label: 'Back to group', onPress: back }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {/* Amount & Parties Hero Card */}
          <Card style={styles.heroCard}>
            <View style={styles.amountHeader}>
              <Text style={{ color: colors.muted, fontSize: typography.caption, fontWeight: '600', textTransform: 'uppercase' }}>
                Amount Settled
              </Text>
              <Text style={{ color: colors.text, fontSize: typography.hero, fontWeight: '900' }}>
                {formatPaise(settlement.amountPaise)}
              </Text>
            </View>

            <View style={[styles.partiesDivider, { backgroundColor: colors.border }]} />

            {/* Payer -> Receiver flow */}
            <View style={styles.parties}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={'View ' + (payer?.fullName ?? '')}
                onPress={() => router.push(('/group/' + groupId + '/person/' + settlement.payerId) as never)}
                style={styles.party}
              >
                <Avatar name={payer?.fullName ?? '?'} size={44} />
                <View style={styles.partyText}>
                  <Text style={{ color: colors.muted, fontSize: typography.xs }}>Paid by</Text>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700' }}>
                    {iAmPayer ? 'You' : payer?.fullName}
                  </Text>
                </View>
              </Pressable>

              <View style={[styles.arrowCircle, { backgroundColor: colors.subtle }]}>
                <Icon name="forward" size={16} tone="primary" />
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={'View ' + (receiver?.fullName ?? '')}
                onPress={() => router.push(('/group/' + groupId + '/person/' + settlement.receiverId) as never)}
                style={styles.party}
              >
                <Avatar name={receiver?.fullName ?? '?'} size={44} />
                <View style={styles.partyText}>
                  <Text style={{ color: colors.muted, fontSize: typography.xs }}>Received by</Text>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700' }}>
                    {iAmReceiver ? 'You' : receiver?.fullName}
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Status & Method Badges */}
            <View style={styles.badges}>
              <Badge
                label={SETTLEMENT_STATUS_LABELS[settlement.status] ?? settlement.status}
                tone={
                  settlement.status === 'completed'
                    ? 'positive'
                    : settlement.status === 'rejected'
                      ? 'negative'
                      : settlement.status === 'will_pay_soon'
                        ? 'info'
                        : 'warning'
                }
              />
              <Badge label={settlement.paymentMethod === 'upi' ? 'UPI' : 'Cash'} />
            </View>

            <Text style={{ color: colors.muted, fontSize: typography.caption, lineHeight: 18 }}>
              {settlement.status === 'completed'
                ? 'Confirmed. The balance between these members has moved.'
                : settlement.status === 'will_pay_soon'
                  ? 'A promise to pay. No balance has changed.'
                  : settlement.status === 'rejected'
                    ? 'Payment rejected by recipient. No balance changed.'
                    : settlement.status === 'cancelled'
                      ? 'Withdrawn before confirmation.'
                      : 'Waiting on recipient confirmation. Balance updates once confirmed.'}
            </Text>
          </Card>

          {/* Lifecycle Timeline */}
          <Card>
            <SectionHeader title="Settlement Lifecycle" />
            <Timeline settlement={settlement} />
          </Card>

          {/* Details Card */}
          <Card>
            <SectionHeader title="Details" />
            <DetailRow label="Recorded" value={formatInstant(settlement.createdAt)} />
            <DetailRow label="Marked Paid" value={formatInstant(settlement.paidAt)} />
            {settlement.verifiedAt ? (
              <DetailRow label="Confirmed" value={formatInstant(settlement.verifiedAt)} />
            ) : null}
            {settlement.note ? <DetailRow label="Note" value={settlement.note} /> : null}
            {settlement.rejectionReason ? (
              <DetailRow label="Rejection Reason" value={settlement.rejectionReason} tone={colors.destructive} />
            ) : null}
          </Card>

          {/* Payment Proof Card */}
          {settlement.proofUrl ? (
            <Card>
              <SectionHeader title="Payment Proof" />
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel="View payment proof full size"
                onPress={() => setViewProof(true)}
                style={styles.proofContainer}
              >
                <Image
                  source={{ uri: settlement.proofUrl }}
                  style={styles.proof}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
                <View style={styles.expandOverlay}>
                  <Icon name="maximize" size={16} tone="inverse" />
                  <Text style={{ color: '#FFFFFF', fontSize: typography.caption, fontWeight: '700' }}>
                    Tap to expand
                  </Text>
                </View>
              </Pressable>
            </Card>
          ) : null}

          {/* Actions */}
          <View style={styles.actions}>
            {settlement.status === 'paid_pending_approval' && iAmReceiver ? (
              <>
                <PrimaryButton
                  label="Confirm Receipt"
                  icon="check"
                  loading={busy}
                  onPress={() =>
                    void run('confirm receipt', () => settlementsApi.approve(groupId, settlement.id))
                  }
                />
                <PrimaryButton
                  label="I Did Not Receive This"
                  variant="danger"
                  onPress={() => setAction('reject')}
                />
              </>
            ) : null}

            {(settlement.status === 'paid_pending_approval' || settlement.status === 'will_pay_soon') &&
            iAmPayer ? (
              <PrimaryButton
                label="Withdraw Settlement"
                variant="danger"
                onPress={() => setAction('cancel')}
              />
            ) : null}

            {settlement.status === 'rejected' && iAmPayer ? (
              <PrimaryButton
                label="Upload Better Proof"
                variant="secondary"
                icon="camera"
                onPress={() => setAction('proof')}
              />
            ) : null}
          </View>
        </ScrollView>
      )}

      {/* Confirmation Sheets */}
      <Sheet
        visible={action === 'reject'}
        onClose={() => setAction(null)}
        title="Reject Payment"
        subtitle="The payer will be notified and can re-upload proof or retry."
        footer={
          <>
            <PrimaryButton
              label="Reject Payment"
              variant="danger"
              loading={busy}
              onPress={() =>
                settlement
                  ? void run('reject payment', () =>
                      settlementsApi.reject(groupId, settlement.id, reason.trim() || undefined),
                    )
                  : undefined
              }
            />
            <PrimaryButton label="Cancel" variant="secondary" onPress={() => setAction(null)} />
          </>
        }
      >
        <TextField
          label="Reason (Optional)"
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Money not received in bank account"
          maxLength={300}
        />
      </Sheet>

      <Sheet
        visible={action === 'cancel'}
        onClose={() => setAction(null)}
        title="Withdraw Settlement?"
        subtitle="This request will be cancelled and will no longer await recipient confirmation."
        footer={
          <>
            <PrimaryButton
              label="Confirm Withdrawal"
              variant="danger"
              loading={busy}
              onPress={() =>
                settlement
                  ? void run('withdraw settlement', () => settlementsApi.cancel(groupId, settlement.id))
                  : undefined
              }
            />
            <PrimaryButton label="Keep Settlement" variant="secondary" onPress={() => setAction(null)} />
          </>
        }
      >
        <Text style={{ color: colors.muted, fontSize: typography.body, lineHeight: 22 }}>
          Your outstanding debt will revert to what it was before this settlement was recorded.
        </Text>
      </Sheet>

      <Sheet
        visible={action === 'proof'}
        onClose={() => setAction(null)}
        title="Re-upload Payment Proof"
        footer={
          <PrimaryButton
            label="Submit Proof"
            loading={busy}
            disabled={!newProof}
            onPress={() =>
              settlement && newProof
                ? void run('upload proof', () =>
                    settlementsApi.reuploadProof(groupId, settlement.id, newProof),
                  )
                : undefined
            }
          />
        }
      >
        <ReceiptField
          label="New Payment Screenshot"
          url={newProof}
          onChange={setNewProof}
          folder="splitwise/proofs"
        />
      </Sheet>

      <Sheet visible={viewProof} onClose={() => setViewProof(false)} title="Payment Proof">
        {settlement?.proofUrl ? (
          <Image
            source={{ uri: settlement.proofUrl }}
            style={styles.proofFull}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessibilityLabel="Payment proof full preview"
          />
        ) : null}
      </Sheet>
    </SafeAreaView>
  );
}

/**
 * Sleek timeline of settlement steps.
 */
function Timeline({ settlement }: { settlement: Settlement }) {
  const { colors } = useTheme();

  const steps: { label: string; at: string | null; done: boolean; tone?: string }[] = [
    { label: 'Settlement recorded', at: settlement.createdAt, done: true },
    {
      label: settlement.status === 'will_pay_soon' ? 'Payment promised' : 'Marked as paid',
      at: settlement.paidAt,
      done: true,
    },
    {
      label: 'Proof uploaded',
      at: null,
      done: settlement.hasProof,
    },
  ];

  if (settlement.status === 'rejected') {
    steps.push({ label: 'Rejected by receiver', at: settlement.verifiedAt, done: true, tone: colors.destructive });
  } else if (settlement.status === 'cancelled') {
    steps.push({ label: 'Withdrawn by payer', at: null, done: true, tone: colors.muted });
  } else {
    steps.push({
      label: 'Confirmed by receiver',
      at: settlement.verifiedAt,
      done: settlement.status === 'completed',
    });
    steps.push({
      label: 'Completed & balance updated',
      at: settlement.verifiedAt,
      done: settlement.status === 'completed',
      tone: colors.success,
    });
  }

  return (
    <View style={styles.timeline}>
      {steps.map((step, index) => (
        <View key={step.label} style={styles.step}>
          <View style={styles.rail}>
            <View
              style={[
                styles.node,
                {
                  backgroundColor: step.done ? step.tone ?? colors.primary : 'transparent',
                  borderColor: step.done ? step.tone ?? colors.primary : colors.border,
                },
              ]}
            >
              {step.done ? <Icon name="check" size={10} tone="inverse" /> : null}
            </View>
            {index < steps.length - 1 ? (
              <View style={[styles.line, { backgroundColor: colors.border }]} />
            ) : null}
          </View>

          <View style={styles.stepBody}>
            <Text
              style={{
                color: step.done ? colors.text : colors.muted,
                fontSize: typography.bodySm,
                fontWeight: step.done ? '700' : '400',
              }}
            >
              {step.label}
            </Text>
            {step.at && step.done ? (
              <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                {formatInstant(step.at)}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
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
  heroCard: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  amountHeader: {
    alignItems: 'center',
    gap: 4,
  },
  partiesDivider: {
    height: 1,
    marginVertical: spacing.xs,
  },
  parties: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.xs,
  },
  party: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: '42%',
  },
  partyText: {
    flex: 1,
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  timeline: {
    paddingTop: spacing.xs,
  },
  step: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rail: {
    alignItems: 'center',
    width: 20,
  },
  node: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  line: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  stepBody: {
    flex: 1,
    paddingBottom: spacing.lg,
    gap: 2,
  },
  proofContainer: {
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  proof: {
    width: '100%',
    height: 200,
  },
  expandOverlay: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  proofFull: {
    width: '100%',
    height: 440,
    borderRadius: radius.sm,
  },
  actions: {
    gap: spacing.sm,
  },
});
