import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useAds } from './AdProvider';
import { AD_PLACEMENTS, adsConfig, type AdPlacement } from './config';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

/**
 * The only advertisement surface in the app.
 *
 * NO RESERVED SPACE UNTIL AN AD EXISTS. The container has zero height until the SDK says
 * an ad has loaded, and collapses back to zero if it fails or goes unfilled. That is the
 * opposite of the usual approach of reserving a 50dp box up front, and it is deliberate:
 * a permanent grey rectangle where an ad might one day appear is worse than no ad, and a
 * box that fills in later shoves the content someone is reading down the screen.
 *
 * Because the height only ever goes from nothing to something at the bottom of a scroll,
 * nothing above it moves.
 *
 * IT IS ALSO OBVIOUSLY AN ADVERTISEMENT. A quiet "Sponsored" label and a plain border
 * keep it from reading as a SplitWise card. Ads that imitate the surrounding product are
 * how people tap them by mistake, which is bad for the user and, being invalid traffic,
 * bad for the account too.
 */
export function AdBanner({ placement }: { placement: AdPlacement }) {
  const { colors } = useTheme();
  const { canShowAds, setBannerHeight } = useAds();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  /*
   * Pinned on first render. `BannerAd` treats a changing `unitId` as a new ad and
   * re-requests, so reading it straight from config on every render would fire a fresh
   * request each time the parent re-rendered.
   */
  const unitId = useRef(adsConfig.units.banner).current;

  /*
   * The allow-list, enforced rather than documented.
   *
   * A banner rendered on a screen nobody added to `AD_PLACEMENTS` shows nothing, so
   * placing one somewhere it does not belong fails visibly in review instead of quietly
   * shipping an advertisement into a settlement flow.
   */
  const allowed = (Object.values(AD_PLACEMENTS) as string[]).includes(placement);

  // Nothing at all: not allow-listed, disabled, no consent, ad-free, or already failed.
  if (!allowed || !canShowAds || failed) return null;

  return (
    <View
      style={styles.wrap}
      // Measured rather than assumed: an anchored adaptive banner's height depends on the
      // screen, so hard-coding 50dp would be wrong on most devices.
      onLayout={(event) => setBannerHeight(loaded ? event.nativeEvent.layout.height : 0)}
      pointerEvents="box-none"
      accessibilityLabel={'Advertisement' + (adsConfig.useTestAds ? ' (test)' : '')}
    >
      {loaded ? (
        <Text
          style={{
            color: colors.muted,
            fontSize: typography.caption,
            letterSpacing: 1,
            paddingBottom: spacing.xs,
          }}
        >
          SPONSORED{adsConfig.useTestAds ? '  ·  TEST AD' : ''}
        </Text>
      ) : null}

      <View
        style={[
          loaded ? styles.frame : styles.collapsed,
          loaded ? { borderColor: colors.border, backgroundColor: colors.surface } : null,
        ]}
      >
        <BannerAd
          unitId={unitId}
          // Anchored adaptive: the SDK picks a height appropriate to the screen width,
          // which is the format Google recommends over the fixed legacy sizes.
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            // No user data is attached to an ad request. The app knows what people owe
            // each other, and none of that has any business in an ad call.
            requestNonPersonalizedAdsOnly: false,
          }}
          onAdLoaded={() => {
            console.log('[AdMob] Banner ad loaded successfully for placement:', placement);
            setLoaded(true);
            setFailed(false);
          }}
          onAdFailedToLoad={(error) => {
            console.warn('[AdMob] Banner failed to load (' + placement + '):', error);
            // Covers no-fill as well as errors. Either way the slot disappears and the
            // screen carries on; nothing retries in a loop.
            setLoaded(false);
            setFailed(true);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, alignItems: 'center' },
  // Zero height and hidden overflow, so an unloaded banner occupies nothing at all.
  collapsed: { height: 0, overflow: 'hidden' },
  frame: {
    borderWidth: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
