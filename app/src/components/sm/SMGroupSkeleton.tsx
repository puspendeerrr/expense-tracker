import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing } from '@/theme/tokens';

export function SMGroupSkeletonCard({ style }: { style?: ViewStyle }) {
  const { colors, dark } = useTheme();
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const blockColor = dark ? colors.surface : colors.subtle;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: dark ? colors.surfaceElevated : colors.surface,
          borderColor: dark ? colors.borderStrong : colors.border,
        },
        !dark ? shadows.sm : null,
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.avatarSkeleton,
          {
            backgroundColor: blockColor,
            opacity: pulseAnim,
          },
        ]}
      />

      <View style={styles.bodySkeleton}>
        <Animated.View
          style={[
            styles.titleBar,
            {
              backgroundColor: blockColor,
              opacity: pulseAnim,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.metaBar,
            {
              backgroundColor: blockColor,
              opacity: pulseAnim,
            },
          ]}
        />
      </View>

      <Animated.View
        style={[
          styles.actionSkeleton,
          {
            backgroundColor: blockColor,
            opacity: pulseAnim,
          },
        ]}
      />
    </View>
  );
}

export function SMGroupSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <SMGroupSkeletonCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    width: '100%',
  },
  avatarSkeleton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
  },
  bodySkeleton: {
    flex: 1,
    gap: spacing.xs,
  },
  titleBar: {
    width: '65%',
    height: 16,
    borderRadius: radius.xs,
  },
  metaBar: {
    width: '40%',
    height: 12,
    borderRadius: radius.xs,
  },
  actionSkeleton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
  },
});
