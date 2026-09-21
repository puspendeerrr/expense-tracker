import type { ExpoConfig } from 'expo/config';

/**
 * Native configuration, per environment.
 *
 * Derived from the environment rather than fixed, because production genuinely differs
 * from development: it drops the development launcher, blocks the permissions that
 * launcher brings with it, and refuses to build against a non-HTTPS API. Keeping those
 * differences here — rather than in a second config file that drifts — means there is one
 * description of the app, and it states its own variations.
 */

type Environment = 'development' | 'staging' | 'production';

const environment = (process.env.EXPO_PUBLIC_APP_ENV ?? 'development') as Environment;
const isProduction = environment === 'production';

/*
 * AdMob application ids.
 *
 * Baked into the native project by the config plugin, so they must be known at build time
 * -- unlike the ad unit ids, which are read at runtime. They are not secrets: every app id
 * ships inside the APK. Google's own sample ids are the fallback, so a fresh checkout
 * builds and shows test ads without any configuration.
 */
const ADMOB_ANDROID_APP_ID =
  process.env.EXPO_PUBLIC_ANDROID_ADMOB_APP_ID?.trim() || 'ca-app-pub-3940256099942544~3347511713';
const ADMOB_IOS_APP_ID =
  process.env.EXPO_PUBLIC_IOS_ADMOB_APP_ID?.trim() || 'ca-app-pub-3940256099942544~1458002511';

/**
 * A production build must not be pointed at a development backend.
 *
 * Failing the build is the right response. Shipping an APK that talks to
 * `http://127.0.0.1:5000` produces an app that simply does not work, and finding that out
 * from a one-star review is much worse than finding it out here.
 */
if (isProduction) {
  const api = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!api || !api.startsWith('https://')) {
    throw new Error(
      'Production builds require EXPO_PUBLIC_API_URL to be an https:// address. Got: ' +
        (api || '(unset)'),
    );
  }
  if (ADMOB_ANDROID_APP_ID.includes('3940256099942544')) {
    throw new Error(
      'Production builds must not use Google’s sample AdMob app id. Set EXPO_PUBLIC_ANDROID_ADMOB_APP_ID.',
    );
  }
}

/**
 * Permissions, stated explicitly rather than inherited.
 *
 * Three real problems turned up by reading the GENERATED manifest, which is the only place
 * the truth shows up. Every one arrived from a dependency's own manifest rather than from
 * anything this app asked for:
 *
 *   POST_NOTIFICATIONS      was MISSING, and is required from Android 13. Without it the
 *                           notification permission cannot be granted on a modern phone,
 *                           which would have quietly disabled Phase 4 on the very device
 *                           it was tested on (Android 16).
 *
 *   RECORD_AUDIO            arrives with expo-image-picker's video support, which this app
 *                           does not use. A finance app asking for the microphone is a
 *                           privacy problem and a Play review risk.
 *
 *   WRITE_EXTERNAL_STORAGE  the app only ever reads an image the user picked.
 *
 * SYSTEM_ALERT_WINDOW ("draw over other apps") comes from the development launcher. It is
 * blocked in production only — blocking it in development would break the dev menu the
 * USB workflow depends on.
 */
const ANDROID_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.VIBRATE',
  'android.permission.POST_NOTIFICATIONS',
];

const BLOCKED_PERMISSIONS = [
  'android.permission.RECORD_AUDIO',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  ...(isProduction ? ['android.permission.SYSTEM_ALERT_WINDOW'] : []),
];

const plugins: ExpoConfig['plugins'] = [
  'expo-router',
  // The development launcher has no place in a store build.
  ...(isProduction ? [] : ['expo-dev-client']),
  'expo-secure-store',
  [
    'expo-notifications',
    {
      /*
       * Android draws the small icon as a silhouette: every non-transparent pixel becomes
       * white and colour is discarded. It must be a white-on-transparent glyph, not the
       * colour app icon, or it renders as a plain white square.
       */
      icon: './assets/notification-icon.png',
      color: '#087F5B',
      defaultChannel: 'general',
    },
  ],
  [
    'react-native-google-mobile-ads',
    { androidAppId: ADMOB_ANDROID_APP_ID, iosAppId: ADMOB_IOS_APP_ID },
  ],
  [
    'expo-image-picker',
    {
      photosPermission: 'SplitMoney uses your photos so you can attach a receipt to an expense.',
      cameraPermission: 'SplitMoney uses the camera so you can photograph a receipt.',
      // Explicitly off. The app attaches still images only, and this is what drags
      // RECORD_AUDIO into the manifest.
      microphonePermission: false,
    },
  ],
];

const config: ExpoConfig = {
  name: 'SplitMoney',
  slug: 'splitwise-mobile',

  /** What people see. `versionCode` below is what Play actually orders builds by. */
  version: '0.1.0',

  /*
   * `splitmoney` is the product's scheme. The two `splitwise` entries are kept because
   * the development client launches through `exp+splitwise-mobile` and any link already
   * written against the old scheme should not break. Adding costs nothing; removing would
   * strand existing links.
   */
  scheme: ['splitmoney', 'splitwise-mobile', 'splitwise'],
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  platforms: ['android', 'ios'],

  android: {
    /*
     * DELIBERATELY UNCHANGED, and this is the last cheap moment to change it.
     *
     * An application id is immutable once an app is published -- Play treats a different
     * id as a different app -- so renaming it to `com.chaten.splitmoney.mobile` must
     * happen before the first release or never.
     *
     * It is not renamed here for one practical reason: a new id is a new app to Android,
     * with empty keystore storage, so every tester is signed out and must sign in again.
     * That trade is worth making deliberately, alongside the first production build, not
     * in the middle of a UI phase. It is recorded as the FIRST task of Phase 9.
     *
     * Users do not see this string; they see `name`, which is now SplitMoney.
     */
    package: 'com.chaten.splitwise.mobile',
    /*
     * Must increase with every upload and never repeat -- Play rejects a duplicate
     * outright. Read from the environment so CI can drive it; 1 for local builds.
     */
    versionCode: Number(process.env.ANDROID_VERSION_CODE ?? '1'),
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#087F5B' },
    predictiveBackGestureEnabled: true,
    permissions: ANDROID_PERMISSIONS,
    blockedPermissions: BLOCKED_PERMISSIONS,
  },

  ios: {
    bundleIdentifier: 'com.chaten.splitwise.mobile',
    buildNumber: process.env.IOS_BUILD_NUMBER ?? '1',
    supportsTablet: false,
  },

  plugins,
  experiments: { typedRoutes: true },

  /** Readable at runtime, so a build can say which environment it came from. */
  extra: { environment },
};

export default config;
