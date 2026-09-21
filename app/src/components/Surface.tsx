import { View, type ViewProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing } from '@/theme/tokens';

export function Surface({ style, ...props }: ViewProps) {
  const { colors, dark } = useTheme();
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: spacing.base,
          gap: spacing.md,
        },
        !dark ? shadows.sm : null,
        style,
      ]}
    />
  );
}
