import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

/**
 * Everything the ads layer is allowed to know.
 *
 * AdMob identifiers are configuration, not secrets: an app id and an ad unit id are
 * compiled into every APK Google Play distributes and are readable by anyone who cares to
 * look. They are kept in `EXPO_PUBLIC_*` for exactly that reason — they belong to the
 * build, not to the backend, and putting them in the server's `.env` would be filing them
 * in the wrong place.
 *
 * What must never appear here: the backend session cookie, the Gemini key, Cloudinary
 * credentials, or anything about a user's money.
 */

const flag = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value.trim() === '') return fallback;
  return value.trim().toLowerCase() === 'true';
};

const environment = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';

/**
 * Test ads in anything that is not production.
 *
 * This is not a preference. Requesting live ads from a development build, and certainly
 * clicking one, is invalid traffic and gets AdMob accounts suspended. Google publishes
 * dedicated test units for this, and `TestIds` is the package's binding to them.
 *
 * Deriving it from the environment rather than from `__DEV__` means a release-configured
 * build pointed at staging still uses test units.
 */
export const useTestAds = environment !== 'production';

const unit = (production: string | undefined, test: string): string =>
  useTestAds ? test : (production?.trim() || test);

/** Google's own sample app ids, used until real ones are configured. */
const SAMPLE_APP_ID = {
  android: 'ca-app-pub-3940256099942544~3347511713',
  ios: 'ca-app-pub-3940256099942544~1458002511',
};

export const adsConfig = {
  environment,

  /**
   * The master switch. Off means the SDK is never initialised, no ad component renders
   * anything, and no network request is made — not "ads load but stay hidden".
   */
  enabled: flag(process.env.EXPO_PUBLIC_ADS_ENABLED, true),

  useTestAds,

  appId:
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_IOS_ADMOB_APP_ID?.trim() || SAMPLE_APP_ID.ios
      : process.env.EXPO_PUBLIC_ANDROID_ADMOB_APP_ID?.trim() || SAMPLE_APP_ID.android,

  units: {
    banner:
      Platform.OS === 'ios'
        ? unit(process.env.EXPO_PUBLIC_IOS_BANNER_AD_UNIT_ID, TestIds.BANNER)
        : unit(process.env.EXPO_PUBLIC_ANDROID_BANNER_AD_UNIT_ID, TestIds.BANNER),
    interstitial:
      Platform.OS === 'ios'
        ? unit(process.env.EXPO_PUBLIC_IOS_INTERSTITIAL_AD_UNIT_ID, TestIds.INTERSTITIAL)
        : unit(process.env.EXPO_PUBLIC_ANDROID_INTERSTITIAL_AD_UNIT_ID, TestIds.INTERSTITIAL),
  },

  /**
   * Full-screen ads are OFF.
   *
   * The infrastructure exists so that enabling them later is a configuration change rather
   * than a rewrite, but nothing shows one today. An interstitial is the most disruptive
   * format there is, and this app is one people open to settle up with a flatmate — the
   * bar for interrupting that is high, and "we built the manager" does not clear it.
   */
  interstitialsEnabled: flag(process.env.EXPO_PUBLIC_ADS_INTERSTITIALS_ENABLED, false),

  /** Frequency limits, in one place so no screen can invent its own. */
  frequency: {
    /** Minimum gap between two full-screen ads. */
    interstitialCooldownMs: 5 * 60 * 1000,
    /** Ceiling per app session, whatever the cooldown would otherwise allow. */
    maxInterstitialsPerSession: 3,
    /** A fresh ad is not requested more often than this for the same placement. */
    bannerRefreshMs: 60 * 1000,
  },
} as const;

/**
 * Where a banner may appear.
 *
 * An allow-list, not a deny-list. A screen added next year gets no ads until somebody
 * names it here, which is the right default: forgetting to add a placement costs
 * revenue, forgetting to exclude one costs a user being shown an advertisement in the
 * middle of settling a debt.
 *
 * Deliberately absent, and never to be added: Add/Edit Expense, settling up, settlement
 * confirmation, the UPI hand-off, sign-in, OTP, password reset, security and device
 * management, the AI chat, and any destructive confirmation.
 */
export const AD_PLACEMENTS = {
  home: 'home',
  groups: 'groups',
  activity: 'activity',
} as const;

export type AdPlacement = (typeof AD_PLACEMENTS)[keyof typeof AD_PLACEMENTS];
