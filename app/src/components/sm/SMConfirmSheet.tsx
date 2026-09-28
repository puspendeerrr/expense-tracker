import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SMSheet } from './SMSheet';
import { SMButton } from './SMButton';
import { Icon, type IconName } from '../Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

export type SMConfirmSheetProps = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  /** What actually happens, when the consequence deserves spelling out. */
  detail?: string;
  /** A refusal from the server, shown inline so the sheet need not hand off to an alert. */
  errorMessage?: string | null;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  icon?: IconName;
};

/**
 * A focused confirmation.
 *
 * Replaces every `Alert.alert` confirmation in the product. A system alert is the
 * operating system interrupting you; it is right for "your battery is low" and wrong for
 * "leave this group?", which is a decision inside the app and should look like one.
 *
 * THE CANCEL IS THE PROMINENT BUTTON. On a destructive confirmation the safe choice gets
 * the solid treatment and sits first — where a thumb travelling up the screen arrives —
 * and the destructive one is an outline below it. Somebody who opened this sheet by
 * accident should find the exit before the trapdoor.
 *
 * The wording is the caller's, and it is meant to be plain. No "Are you sure?", no
 * pre-selected safe default dressed up as a recommendation, no guilt.
 */
export function SMConfirmSheet({
  visible,
  onCancel,
  onConfirm,
  title,
  description,
  detail,
  errorMessage,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  icon,
}: SMConfirmSheetProps) {
  const { colors, dark } = useTheme();

  const tone = destructive ? colors.destructive : colors.primary;
  const wash = destructive
    ? colors.destructiveSubtle ?? colors.subtle
    : colors.primarySubtle ?? colors.subtle;

  return (
    <SMSheet
      visible={visible}
      // A confirmation must not be dismissible into an ambiguous state, but tapping the
      // scrim is a cancel -- the same as the cancel button, never the confirm.
      onClose={loading ? () => {} : onCancel}
      footer={
        <>
          <SMButton
            label={cancelLabel}
            variant={destructive ? 'primary' : 'outline'}
            size="lg"
            fullWidth
            disabled={loading}
            onPress={onCancel}
          />
          <SMButton
            label={confirmLabel}
            variant={destructive ? 'outline' : 'primary'}
            size="lg"
            fullWidth
            loading={loading}
            onPress={onConfirm}
            labelStyle={destructive ? { color: colors.destructive } : undefined}
            style={destructive ? { borderColor: colors.destructive } : undefined}
          />
        </>
      }
    >
      <View style={styles.content}>
        <View
          style={[
            styles.badge,
            { backgroundColor: wash, borderColor: destructive ? colors.destructive : colors.primary },
          ]}
        >
          <Icon name={icon ?? (destructive ? 'alert' : 'info')} size={26} color={tone} />
        </View>

        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>

        <Text style={[styles.description, { color: colors.muted }]}>{description}</Text>

        {detail ? (
          <View
            style={[
              styles.detail,
              {
                backgroundColor: dark ? colors.surface : colors.subtle,
                borderColor: dark ? colors.borderStrong : colors.border,
              },
            ]}
          >
            <Text style={[styles.detailText, { color: colors.muted }]}>{detail}</Text>
          </View>
        ) : null}

        {/*
          A refusal belongs here, next to the button that caused it, rather than in a
          system alert stacked on top of this sheet. The sheet stays open so the sentence
          is attached to the decision it is about, and so a retry is one tap away.
        */}
        {errorMessage ? (
          <View
            style={[
              styles.detail,
              {
                backgroundColor: colors.destructiveLight,
                borderColor: colors.destructive,
              },
            ]}
          >
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.detailText, { color: colors.destructive, fontWeight: '600' }]}
            >
              {errorMessage}
            </Text>
          </View>
        ) : null}
      </View>
    </SMSheet>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm },
  badge: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.titleSm,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  description: {
    fontSize: typography.bodySm,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 320,
  },
  detail: {
    width: '100%',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  detailText: { fontSize: typography.caption, lineHeight: 19 },
});
