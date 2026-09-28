import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

export type SMAvatarProps = {
  name: string;
  uri?: string | null;
  size?: number;
  /** Squircle by default; a circle when the avatar stands for a person in a list. */
  round?: boolean;
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || '?';

/**
 * One person, as a face or their initials.
 *
 * FALLS BACK ON ERROR, NOT JUST ON ABSENCE. The legacy avatar rendered an `<Image>`
 * whenever a uri existed, so a dead Cloudinary link left a hole in the row. Here a failed
 * load flips back to initials, because a broken image and no image should look the same to
 * the person reading the screen.
 *
 * Initials are tinted with the app's green rather than a colour derived from the name.
 * Hashing a name to a hue looks lively on a design mock and produces unreadable
 * combinations on real data, with no way to fix the one that comes out badly.
 */
export function SMAvatar({ name, uri, size = 40, round = false }: SMAvatarProps) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);

  const shape = {
    width: size,
    height: size,
    borderRadius: round ? size / 2 : Math.min(radius.md, size / 3),
  };

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        style={[shape, { backgroundColor: colors.subtle }]}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View
      style={[
        shape,
        styles.fallback,
        { backgroundColor: colors.primarySubtle ?? colors.subtle },
      ]}
    >
      <Text style={[styles.initials, { color: colors.primary, fontSize: size * 0.36 }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontWeight: '800', letterSpacing: -0.2 },
});
