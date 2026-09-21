import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { useAiChat, type AiScreenContext } from '@/ai/AiChatProvider';
import { useAds } from '@/features/ads';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/**
 * The floating way into the assistant.
 *
 * Rendered once, beside the navigator in the authenticated layout, so it is present on
 * every signed-in screen without each screen having to remember it — and so it is
 * automatically absent from sign-in, where there is no data to ask about.
 *
 * It hides itself on the chat screen: a button that opens the thing you are already
 * looking at is just something covering the text.
 *
 * WHAT "SCREEN-AWARE" MEANS HERE
 * The pathname says which kind of thing is on screen. That is turned into a context used
 * for ONE purpose: choosing better suggested questions. It is not an authorisation hint,
 * it is not sent to the server as a trusted field, and it changes no answer by itself —
 * the backend resolves every question against the user's own authorised data regardless.
 */

/** Routes where the button would be in the way or make no sense. */
const HIDDEN = ['/ai', '/sign-in'];

/**
 * Reads the current route into a context.
 *
 * Only the KIND is derived from the path. The label is filled in by whichever screen
 * knows the real name, via `setScreen` — deriving a human name from a UUID in a URL is
 * not something a path can do.
 */
const kindForPath = (pathname: string): AiScreenContext['kind'] => {
  if (/\/group\/[^/]+\/expense\/[^/]+/.test(pathname)) return 'expense';
  if (/\/group\/[^/]+\/settlement\/[^/]+/.test(pathname)) return 'settlement';
  if (/\/group\/[^/]+\/person\/[^/]+/.test(pathname)) return 'person';
  if (/\/group\/[^/]+/.test(pathname)) return 'group';
  return 'none';
};

export function AiFab() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { screen, setScreen, busy } = useAiChat();
  const { bannerHeight } = useAds();

  const scale = useRef(new Animated.Value(1)).current;

  /*
   * Keeps the context's KIND in step with navigation. The label is left alone: a screen
   * that has one sets it, and one that has not yet loaded should not have its name
   * cleared and re-set on every render.
   */
  const kind = kindForPath(pathname);
  useEffect(() => {
    if (screen.kind !== kind) setScreen({ kind, ...(kind === 'none' ? {} : { label: screen.label }) });
  }, [kind, screen.kind, screen.label, setScreen]);

  if (HIDDEN.some((route) => pathname.startsWith(route))) return null;

  const press = (to: number): void => {
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          /*
           * Clear of the gesture bar, of any footer a screen puts at the bottom, and of a
           * displayed ad banner. Overlapping the ad was caught on a real device: the
           * button sat on top of the banner's right-hand edge, which risks an accidental
           * ad tap and is against AdMob's policy on obscured ads.
           */
          bottom: Math.max(insets.bottom, spacing.md) + spacing.xl + bannerHeight,
          right: spacing.lg,
          transform: [{ scale }],
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={busy ? 'SplitMoney AI, writing an answer' : 'Ask SplitMoney AI'}
        accessibilityHint="Opens the assistant, which answers questions about your expenses and balances"
        onPressIn={() => press(0.92)}
        onPressOut={() => press(1)}
        onPress={() => router.push('/ai')}
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            // A ring while it is thinking, so closing the chat does not hide that an
            // answer is still on its way.
            borderColor: busy ? colors.onPrimary : 'transparent',
          },
        ]}
      >
        <Icon name="ai" size={24} tone="onPrimary" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  fab: {
    // 56 clears the 48dp minimum target comfortably.
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
