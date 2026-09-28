import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

export type SMSegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: IconName;
  /** A small dot, for a section that wants attention. Not a count. */
  attention?: boolean;
};

export type SMSegmentedNavProps<T extends string> = {
  options: SMSegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
};

/**
 * Section navigation for a screen with more destinations than fit across a phone.
 *
 * A SLIDING INDICATOR, NOT A RE-TINTED PILL. The selected segment is marked by one
 * underline that travels, so the eye follows the movement and understands the sections as
 * one row rather than as separate buttons that happen to light up. Tinting each pill makes
 * every change look like a fresh decision; moving one bar makes it look like a place.
 *
 * The indicator is positioned from measured layout rather than assumed widths, because the
 * labels are words of different lengths and dynamic type can change them at runtime.
 *
 * HORIZONTALLY SCROLLABLE, DELIBERATELY. Six equal columns on a 360dp screen gives each
 * about 55dp, which truncates every label to three characters. A scrolling strip of
 * readable words beats a row of abbreviations nobody can decode, and the selected item is
 * scrolled into view so it is never hidden off the edge.
 */
export function SMSegmentedNav<T extends string>({
  options,
  value,
  onChange,
  style,
}: SMSegmentedNavProps<T>) {
  const { colors, dark } = useTheme();

  const scrollRef = useRef<ScrollView>(null);
  /** Measured x/width per segment, so the indicator lands on real geometry. */
  const layouts = useRef<Record<string, { x: number; width: number }>>({});

  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorW = useRef(new Animated.Value(0)).current;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const target = layouts.current[value];
    if (!target) return;

    Animated.parallel([
      Animated.spring(indicatorX, {
        toValue: target.x,
        useNativeDriver: false,
        friction: 12,
        tension: 140,
      }),
      Animated.spring(indicatorW, {
        toValue: target.width,
        useNativeDriver: false,
        friction: 12,
        tension: 140,
      }),
    ]).start();

    // Keep the active section visible when it sits off the edge of the strip.
    scrollRef.current?.scrollTo({
      x: Math.max(0, target.x - 48),
      animated: ready,
    });
  }, [value, indicatorX, indicatorW, ready]);

  return (
    <View
      style={[
        styles.wrap,
        { borderBottomColor: dark ? colors.borderStrong : colors.border },
        style,
      ]}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
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
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                layouts.current[option.value] = { x, width };
                if (option.value === value) {
                  indicatorX.setValue(x);
                  indicatorW.setValue(width);
                  setReady(true);
                }
              }}
              style={({ pressed }) => [styles.segment, { opacity: pressed ? 0.6 : 1 }]}
            >
              {option.icon ? (
                <Icon
                  name={option.icon}
                  size={15}
                  color={active ? colors.primary : colors.muted}
                />
              ) : null}
              <Text
                style={[
                  styles.label,
                  { color: active ? colors.primary : colors.muted, fontWeight: active ? '700' : '500' },
                ]}
              >
                {option.label}
              </Text>
              {option.attention ? (
                <View style={[styles.dot, { backgroundColor: colors.destructive }]} />
              ) : null}
            </Pressable>
          );
        })}

        <Animated.View
          style={[
            styles.indicator,
            { backgroundColor: colors.primary, left: indicatorX, width: indicatorW },
          ]}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: 1 },
  strip: { paddingHorizontal: spacing.base, position: 'relative' },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    // 46 keeps the whole strip inside a comfortable touch band.
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  label: { fontSize: typography.bodySm, letterSpacing: -0.1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  indicator: {
    position: 'absolute',
    bottom: 0,
    height: 2.5,
    borderTopLeftRadius: radius.pill,
    borderTopRightRadius: radius.pill,
  },
});
