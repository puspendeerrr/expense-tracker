import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';

export type SMAuthFooterProps = {
  promptText: string;
  actionText: string;
  onPress: () => void;
};

export function SMAuthFooter({ promptText, actionText, onPress }: SMAuthFooterProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.prompt, { color: colors.muted }]}>{promptText}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${promptText} ${actionText}`}
        onPress={onPress}
        hitSlop={12}
      >
        <Text style={[styles.action, { color: colors.primary }]}>{actionText}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.sm,
  },
  prompt: {
    fontSize: typography.bodySm,
    fontWeight: '500',
  },
  action: {
    fontSize: typography.bodySm,
    fontWeight: '700',
  },
});

