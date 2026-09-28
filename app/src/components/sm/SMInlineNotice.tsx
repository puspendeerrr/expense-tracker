import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { Icon, type IconName } from '../Icon';

export type SMNoticeType = 'error' | 'warning' | 'info' | 'success';

export type SMInlineNoticeProps = {
  type?: SMNoticeType;
  title?: string;
  message: string;
  style?: ViewStyle;
};

export function SMInlineNotice({
  type = 'error',
  title,
  message,
  style,
}: SMInlineNoticeProps) {
  const { dark } = useTheme();

  const configs: Record<
    SMNoticeType,
    {
      bg: string;
      border: string;
      icon: IconName;
      text: string;
      titleColor: string;
    }
  > = {
    error: {
      bg: dark ? '#450A0A55' : '#FEF2F2',
      border: dark ? '#991B1B' : '#FECACA',
      icon: 'alertCircle',
      text: dark ? '#FCA5A5' : '#B91C1C',
      titleColor: dark ? '#F87171' : '#991B1B',
    },
    warning: {
      bg: dark ? '#451A0355' : '#FFFBEB',
      border: dark ? '#92400E' : '#FDE68A',
      icon: 'alertCircle',
      text: dark ? '#FCD34D' : '#B45309',
      titleColor: dark ? '#FBBF24' : '#92400E',
    },
    info: {
      bg: dark ? '#17255455' : '#EFF6FF',
      border: dark ? '#1E40AF' : '#BFDBFE',
      icon: 'info',
      text: dark ? '#93C5FD' : '#1D4ED8',
      titleColor: dark ? '#60A5FA' : '#1E40AF',
    },
    success: {
      bg: dark ? '#064E3B44' : '#ECFDF5',
      border: dark ? '#065F46' : '#A7F3D0',
      icon: 'checkCircle',
      text: dark ? '#6EE7B7' : '#047857',
      titleColor: dark ? '#34D399' : '#065F46',
    },
  };

  const config = configs[type];

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        styles.container,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
        },
        style,
      ]}
    >
      <View style={styles.iconSlot}>
        <Icon name={config.icon} size={18} color={config.titleColor} />
      </View>

      <View style={styles.content}>
        {title ? (
          <Text style={[styles.title, { color: config.titleColor }]}>{title}</Text>
        ) : null}
        <Text style={[styles.message, { color: config.text }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    width: '100%',
  },
  iconSlot: {
    marginTop: 1,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: typography.caption,
    fontWeight: '700',
  },
  message: {
    fontSize: typography.xs,
    lineHeight: 18,
    fontWeight: '500',
  },
});
