import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { SMAvatar } from './SMAvatar';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';

export type SMSettlementPartiesProps = {
  payerName: string;
  receiverName: string;
  /** "You" replaces the viewer's own name, which is how people read their own money. */
  payerIsMe?: boolean;
  receiverIsMe?: boolean;
};

/**
 * Who paid whom, as two faces and an arrow.
 *
 * Direction is the single most important fact about a settlement, and a sentence like
 * "Rahul — Chaten — ₹780" leaves it to the reader to work out. Payer on the left, receiver
 * on the right, an arrow between: the shape reads before the words do. The whole thing is
 * announced as one sentence so a screen reader states the direction explicitly.
 */
export function SMSettlementParties({
  payerName,
  receiverName,
  payerIsMe = false,
  receiverIsMe = false,
}: SMSettlementPartiesProps) {
  const { colors } = useTheme();

  const payer = payerIsMe ? 'You' : payerName;
  const receiver = receiverIsMe ? 'You' : receiverName;

  return (
    <View
      accessible
      accessibilityLabel={payer + ' paid ' + (receiverIsMe ? 'you' : receiver)}
      style={styles.row}
    >
      <Person name={payerName} label={payer} caption="Paid" />
      <View style={styles.arrow}>
        <View style={[styles.line, { backgroundColor: colors.primary }]} />
        <Icon name="forward" size={18} tone="primary" />
      </View>
      <Person name={receiverName} label={receiver} caption="Received" />
    </View>
  );
}

function Person({ name, label, caption }: { name: string; label: string; caption: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.person}>
      <SMAvatar name={name} size={48} round />
      <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
        {label}
      </Text>
      <Text style={[styles.caption, { color: colors.muted }]}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: spacing.sm },
  person: { flex: 1, alignItems: 'center', gap: 4, maxWidth: 130 },
  name: { fontSize: typography.bodySm, fontWeight: '700', textAlign: 'center' },
  caption: { fontSize: typography.xs },
  arrow: { flexDirection: 'row', alignItems: 'center', paddingTop: 15, gap: 0 },
  line: { width: 28, height: 2, borderRadius: 1, marginRight: -6 },
});
