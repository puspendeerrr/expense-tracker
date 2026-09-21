import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import { motion, radius, shadows, spacing, typography } from '@/theme/tokens';

/* -------------------------------------------------------------------------- */
/* Avatar                                                                     */
/* -------------------------------------------------------------------------- */

export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || '?';

export function Avatar({
  name,
  uri,
  size = 40,
}: {
  name: string;
  uri?: string | null;
  size?: number;
}) {
  const { colors } = useTheme();
  const shape = {
    width: size,
    height: size,
    borderRadius: Math.round(size * 0.35),
  };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[shape, styles.avatarImage, { borderColor: colors.border }]}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View
      style={[
        shape,
        styles.centre,
        {
          backgroundColor: colors.subtle,
          borderColor: colors.border,
          borderWidth: 1,
        },
      ]}
    >
      <Text
        style={{
          color: colors.primary,
          fontSize: Math.round(size * 0.38),
          fontWeight: '800',
          letterSpacing: 0.5,
        }}
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                      */
/* -------------------------------------------------------------------------- */

export type BadgeTone = 'neutral' | 'positive' | 'negative' | 'warning' | 'info';

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: BadgeTone;
}) {
  const { colors } = useTheme();

  const config: Record<
    BadgeTone,
    { text: string; bg: string; border: string }
  > = {
    neutral: {
      text: colors.muted,
      bg: colors.surface,
      border: colors.border,
    },
    positive: {
      text: colors.success,
      bg: colors.successLight,
      border: colors.success,
    },
    negative: {
      text: colors.destructive,
      bg: colors.destructiveLight,
      border: colors.destructive,
    },
    warning: {
      text: colors.warning,
      bg: colors.warningLight,
      border: colors.warning,
    },
    info: {
      text: colors.info,
      bg: colors.infoLight,
      border: colors.info,
    },
  };

  const current = config[tone];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: current.bg,
          borderColor: current.border,
        },
      ]}
    >
      <Text
        style={{
          color: current.text,
          fontSize: typography.xs,
          fontWeight: '700',
          letterSpacing: 0.2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Segmented control                                                          */
/* -------------------------------------------------------------------------- */

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; badge?: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors, dark } = useTheme();

  return (
    <View style={[styles.segmentsContainer, { borderBottomColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.segments}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.segment,
                {
                  backgroundColor: active
                    ? colors.primary
                    : colors.surface,
                  borderColor: active
                    ? colors.primary
                    : colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
                active && !dark ? shadows.sm : null,
              ]}
            >
              <Text
                style={{
                  color: active ? colors.onPrimary : colors.muted,
                  fontSize: typography.caption,
                  fontWeight: active ? '700' : '600',
                }}
              >
                {option.label}
              </Text>
              {option.badge ? (
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: active
                        ? colors.onPrimary
                        : colors.destructive,
                    },
                  ]}
                />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Skeletons                                                                  */
/* -------------------------------------------------------------------------- */

export function Skeleton({
  height = 16,
  width = '100%',
  style,
}: {
  height?: number;
  width?: number | string;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.85,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        {
          height,
          width: width as number,
          borderRadius: radius.xs,
          backgroundColor: colors.border,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

export function CardSkeleton({ rows = 4 }: { rows?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={styles.skeletonList}
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.skeletonCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Skeleton height={44} width={44} style={{ borderRadius: radius.sm }} />
          <View style={styles.skeletonBody}>
            <Skeleton height={14} width="65%" />
            <Skeleton height={12} width="40%" />
          </View>
          <Skeleton height={16} width={60} />
        </View>
      ))}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Rows and cards                                                             */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  onPress,
  accessibilityLabel,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle | ViewStyle[];
}) {
  const { colors, dark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = (): void => {
    if (!onPress) return;
    Animated.timing(scaleAnim, {
      toValue: 0.985,
      duration: motion.duration.fast,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (): void => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  const cardStyle = [
    styles.card,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    !dark ? shadows.sm : null,
    style,
  ];

  if (!onPress) return <View style={cardStyle}>{children}</View>;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          cardStyle,
          { opacity: pressed ? 0.92 : 1 },
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function DetailRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={{ color: colors.muted, fontSize: typography.caption, fontWeight: '500' }}>
        {label}
      </Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text
          style={{
            color: tone ?? colors.text,
            fontSize: typography.bodySm,
            fontWeight: '600',
          }}
        >
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

export function OptionRow({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: selected ? colors.subtle : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.optionBody}>
        <Text
          style={{
            color: colors.text,
            fontSize: typography.bodySm,
            fontWeight: selected ? '700' : '500',
          }}
        >
          {label}
        </Text>
        {detail ? (
          <Text style={{ color: colors.muted, fontSize: typography.caption }}>
            {detail}
          </Text>
        ) : null}
      </View>
      {selected ? <Icon name="check" size={18} tone="primary" /> : null}
    </Pressable>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text
        accessibilityRole="header"
        style={{
          color: colors.muted,
          fontSize: typography.xs,
          fontWeight: '800',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
  avatarImage: { borderWidth: 1 },
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xxs + 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  segmentsContainer: {
    borderBottomWidth: 1,
  },
  segments: {
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm + 2,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  skeletonList: {
    gap: spacing.sm,
    padding: spacing.base,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: 74,
  },
  skeletonBody: { flex: 1, gap: spacing.sm },
  card: {
    padding: spacing.base,
    borderWidth: 1,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    padding: spacing.base,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  optionBody: { flex: 1, gap: 2 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
});
