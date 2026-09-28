import React, { useEffect, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, spacing, typography } from '@/theme/tokens';

export type SMSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Drops the grabber and header padding for a sheet that is all content. */
  bare?: boolean;
  style?: ViewStyle;
};

/**
 * The SplitMoney bottom sheet. Every modal surface in the app is built on this one.
 *
 * It replaces the legacy `Sheet` and the `Alert.alert` calls scattered through the older
 * screens. Those were two different interaction languages in one product — a system alert
 * looks like the operating system interrupting you, which is the right feeling for "your
 * battery is low" and the wrong one for "leave this group?".
 *
 * Built on React Native's `Modal` rather than an absolutely-positioned overlay, because
 * `Modal` supplies the two things a hand-rolled sheet always gets wrong: it renders above
 * everything regardless of parent layout or transforms, and it owns the Android back
 * button.
 *
 * MOTION. The scrim fades while the panel travels, both on the native driver so neither
 * touches the JS thread. The exit is quicker than the entrance — a sheet should feel eager
 * to get out of the way, and matching the two makes dismissal feel sluggish.
 */
export function SMSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  bare = false,
  style,
}: SMSheetProps) {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();

  const progress = useRef(new Animated.Value(0)).current;
  /** Kept mounted for the exit animation, then unmounted. */
  const [mounted, setMounted] = React.useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);

    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? motion.duration.emphasis : motion.duration.normal,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      // Unmount only once the exit has actually played out.
      if (finished && !visible) setMounted(false);
    });
  }, [visible, progress]);

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  if (!mounted) return null;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [Dimensions.get('window').height * 0.42, 0],
  });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title ? 'Close ' + title : 'Close'}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: dark ? 'rgba(0,0,0,0.66)' : 'rgba(15,23,42,0.45)', opacity: progress },
            ]}
          />
        </Pressable>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceElevated ?? colors.surface,
              borderColor: dark ? colors.borderStrong : colors.border,
              paddingBottom: Math.max(insets.bottom, spacing.base),
              transform: [{ translateY }],
            },
            style,
          ]}
        >
          {bare ? null : (
            <View
              style={[styles.grabber, { backgroundColor: dark ? colors.borderStrong : colors.border }]}
            />
          )}

          {title ? (
            <View style={styles.header}>
              <Text
                accessibilityRole="header"
                style={[styles.title, { color: colors.text }]}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>
              ) : null}
            </View>
          ) : null}

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {children}
          </ScrollView>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    // Never full height: the scrim above must stay tappable to dismiss.
    maxHeight: '88%',
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginTop: spacing.md,
  },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.base, gap: spacing.xxs },
  title: { fontSize: typography.titleSm, fontWeight: '800', letterSpacing: -0.2 },
  subtitle: { fontSize: typography.bodySm, lineHeight: 20 },
  body: { flexGrow: 0 },
  bodyContent: { padding: spacing.lg, gap: spacing.sm },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, gap: spacing.sm },
});
