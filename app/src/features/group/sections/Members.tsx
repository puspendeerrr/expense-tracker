import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRef } from 'react';
import { useRouter } from 'expo-router';
import { useGroup } from '../GroupContext';
import { useAuth } from '@/auth/AuthProvider';
import { SMAvatar, SMBadge, SMSectionHeader } from '@/components/sm';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, spacing, typography } from '@/theme/tokens';
import { formatPaise } from '@/lib/money';

export function MembersSection() {
  const { colors } = useTheme();
  const { groupId, detail } = useGroup();
  const { user } = useAuth();
  const router = useRouter();

  const members = detail?.members ?? [];

  return (
    <View style={styles.container}>
      <SMSectionHeader
        title={'Group members (' + members.length + ')'}
        actionLabel="Manage"
        onAction={() => router.push(('/group/' + groupId + '/members') as never)}
      />

      <View style={styles.rows}>
        {members.map((member) => (
          <MemberRow
            key={member.id}
            name={member.fullName}
            email={member.email}
            netPaise={member.netPaise}
            isMe={member.id === user?.id}
            isOwner={member.role === 'creator'}
            onPress={() => router.push(('/group/' + groupId + '/person/' + member.id) as never)}
          />
        ))}
      </View>

      <View
        style={[
          styles.noteBox,
          { backgroundColor: colors.subtle, borderColor: colors.border },
        ]}
      >
        <Icon name="info" size={14} tone="muted" />
        <Text style={[styles.note, { color: colors.muted }]}>
          These are each person&apos;s overall net position in the group. Tap someone to see
          the pairwise breakdown behind it.
        </Text>
      </View>
    </View>
  );
}

/**
 * One member, as a row.
 *
 * The net figure gets a word under it — "owed", "owes", "in group" — rather than relying
 * on red and green to say which way it points. The two badges are tinted differently on
 * purpose: "You" is the app's green because it is about the reader, while "Owner" is
 * neutral because it is a fact about the group.
 */
function MemberRow({
  name,
  email,

  netPaise,
  isMe,
  isOwner,
  onPress,
}: {
  name: string;
  email: string;

  netPaise: number;
  isMe: boolean;
  isOwner: boolean;
  onPress: () => void;
}) {
  const { colors, dark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const press = (to: number): void => {
    Animated.timing(scale, {
      toValue: to,
      duration: motion.duration.fast,
      useNativeDriver: true,
    }).start();
  };

  const settled = netPaise === 0;
  const amountColor = settled
    ? colors.muted
    : netPaise > 0
      ? colors.success
      : colors.destructive;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          name +
          (isMe ? ', you' : '') +
          (isOwner ? ', owner' : '') +
          ', ' +
          (settled
            ? 'all square'
            : (netPaise > 0 ? 'is owed ' : 'owes ') +
              formatPaise(Math.abs(netPaise), { compact: true }))
        }
        onPress={onPress}
        onPressIn={() => press(motion.scale.pressed)}
        onPressOut={() => press(1)}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: colors.surface,
            borderColor: dark ? colors.borderStrong : colors.border,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <SMAvatar name={name} size={42} round />

        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
              {name}
            </Text>
            {isMe ? <SMBadge label="You" tone="primary" /> : null}
            {isOwner ? <SMBadge label="Owner" tone="neutral" /> : null}
          </View>
          <Text numberOfLines={1} style={[styles.email, { color: colors.muted }]}>
            {email}
          </Text>
        </View>

        <View style={styles.amount}>
          <Text numberOfLines={1} style={[styles.amountValue, { color: amountColor }]}>
            {settled ? 'Settled' : formatPaise(Math.abs(netPaise), { compact: true })}
          </Text>
          <Text style={[styles.amountWord, { color: colors.muted }]}>
            {settled ? 'in group' : netPaise > 0 ? 'owed' : 'owes'}
          </Text>
        </View>

        <Icon name="forward" size={14} tone="muted" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.base, gap: spacing.sm },
  rows: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    minHeight: 68,
  },
  body: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  name: { fontSize: typography.bodySm, fontWeight: '700', letterSpacing: -0.1, flexShrink: 1 },
  email: { fontSize: typography.caption },
  amount: { alignItems: 'flex-end', gap: 1, maxWidth: '30%' },
  amountValue: { fontSize: typography.bodySm, fontWeight: '800', letterSpacing: -0.2 },
  amountWord: { fontSize: typography.xs },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  note: { fontSize: typography.xs, lineHeight: 16, flex: 1 },
});
