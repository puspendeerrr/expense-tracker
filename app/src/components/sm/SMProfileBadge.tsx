import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

export type SMProfileBadgeProps = {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

const getInitials = (fullName: string): string =>
  fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || '?';

export function SMProfileBadge({
  name,
  avatarUrl,
  size = 38,
  onPress,
  accessibilityLabel,
  style,
}: SMProfileBadgeProps) {
  const { colors, dark } = useTheme();

  const label = accessibilityLabel ?? `Open profile for ${name}`;
  const badgeSizeStyle = {
    width: size,
    height: size,
    borderRadius: radius.pill,
  };

  const fontSize = Math.max(12, Math.round(size * 0.38));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.container,
        badgeSizeStyle,
        {
          borderColor: dark ? colors.borderStrong : colors.border,
          backgroundColor: dark ? colors.surfaceElevated : colors.subtle,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.image, badgeSizeStyle]}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.fallback, badgeSizeStyle]}>
          <Text
            style={[
              styles.initials,
              {
                fontSize,
                color: colors.primary,
              },
            ]}
          >
            {getInitials(name)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
