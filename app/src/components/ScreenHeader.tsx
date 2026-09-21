import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Icon } from './Icon';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/theme/tokens';

export function ScreenHeader({
  title,
  subtitle,
  right,
  onBack,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
}) {
  const { colors } = useTheme();
  const router = useRouter();

  const goBack = (): void => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  };

  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={goBack}
        hitSlop={12}
        style={({ pressed }) => [
          styles.back,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <Icon name="back" size={20} tone="default" />
      </Pressable>

      <View style={styles.titles}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={{ color: colors.text, fontSize: typography.titleSm, fontWeight: '700' }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: typography.caption }}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right ?? <View style={styles.spacer} />}
    </View>
  );
}

export function SettingsRow({
  label,
  detail,
  value,
  onPress,
  toggle,
  destructive,
  disabled,
}: {
  label: string;
  detail?: string;
  value?: string;
  onPress?: () => void;
  toggle?: { value: boolean; onChange: (next: boolean) => void };
  destructive?: boolean;
  disabled?: boolean;
}) {
  const { colors, dark } = useTheme();
  const tint = destructive ? colors.destructive : colors.text;

  const body = (
    <>
      <View style={styles.rowBody}>
        <Text
          style={{
            color: disabled ? colors.muted : tint,
            fontSize: typography.bodySm,
            fontWeight: '600',
          }}
        >
          {label}
        </Text>
        {detail ? (
          <Text
            style={{
              color: colors.muted,
              fontSize: typography.caption,
              lineHeight: 18,
            }}
          >
            {detail}
          </Text>
        ) : null}
      </View>

      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onChange}
          disabled={disabled}
          accessibilityLabel={label}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={colors.surface}
        />
      ) : value !== undefined ? (
        <Text style={{ color: colors.muted, fontSize: typography.caption, fontWeight: '600' }}>
          {value}
        </Text>
      ) : onPress ? (
        <Icon name="forward" size={16} tone="muted" />
      ) : null}
    </>
  );

  const containerStyle = [
    styles.row,
    {
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    !dark ? shadows.sm : null,
  ];

  if (toggle || !onPress) {
    return <View style={containerStyle}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label + (value ? ', ' + value : '')}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        containerStyle,
        { opacity: pressed ? 0.85 : disabled ? 0.55 : 1 },
      ]}
    >
      {body}
    </Pressable>
  );
}

export function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text
        accessibilityRole="header"
        style={{
          color: colors.muted,
          fontSize: typography.xs,
          fontWeight: '800',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          paddingHorizontal: spacing.xxs,
        }}
      >
        {title}
      </Text>
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1, gap: 2 },
  spacer: { width: 36 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    padding: spacing.base,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  rowBody: { flex: 1, gap: 2 },
  group: { gap: spacing.sm },
  groupBody: { gap: spacing.sm },
});
