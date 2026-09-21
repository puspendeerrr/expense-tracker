import { AppState } from 'react-native';
import { AdEventType, InterstitialAd } from 'react-native-google-mobile-ads';
import { adsConfig } from './config';

/**
 * Full-screen ads.
 *
 * **Disabled.** `adsConfig.interstitialsEnabled` is false and every function below refuses
 * while it stays false. This module exists so that turning them on later is a
 * configuration change and a decision about *where*, rather than a scramble to invent
 * frequency capping under deadline — the logic that stops an interstitial appearing at a
 * terrible moment is the part worth writing carefully, and writing it now means it is
 * reviewed calmly.
 *
 * THE RULES, WHICH LIVE HERE AND NOWHERE ELSE
 *
 * Every counter and timer is in this file. Screens do not keep their own — the reason
 * frequency capping fails in practice is that three screens each track "last shown" and
 * none of them agree, so a user sees three ads in a minute and uninstalls.
 *
 * A screen may only ever ask `showIfEligible`. It cannot ask to show one unconditionally,
 * because there is no such function.
 *
 * WHERE ONE MUST NEVER APPEAR
 *
 * Not on the way into the app, not after signing in, not during adding or editing an
 * expense, not while splitting, not during a settlement or its confirmation, not after
 * the UPI hand-off, not around security or OTP, and never after a notification tap — a
 * notification promised the user a specific thing, and putting an advertisement between
 * the promise and the thing is a bait and switch. Enforced by the fact that only screens
 * that call `showIfEligible` can ever show one, and none of those do.
 */

type State = 'idle' | 'loading' | 'loaded' | 'showing' | 'failed';

let ad: InterstitialAd | null = null;
let state: State = 'idle';
let lastShownAt = 0;
let shownThisSession = 0;
let unsubscribe: (() => void)[] = [];

const teardown = (): void => {
  for (const off of unsubscribe) off();
  unsubscribe = [];
  ad = null;
};

/** True only when showing one right now would break none of the rules. */
export const canShowInterstitial = (): boolean => {
  if (!adsConfig.enabled || !adsConfig.interstitialsEnabled) return false;
  if (state !== 'loaded') return false;
  if (shownThisSession >= adsConfig.frequency.maxInterstitialsPerSession) return false;
  if (Date.now() - lastShownAt < adsConfig.frequency.interstitialCooldownMs) return false;
  // Presenting a full-screen ad while the app is on its way to the background produces an
  // ad nobody sees and, on some devices, one that is still there on return.
  if (AppState.currentState !== 'active') return false;
  return true;
};

/**
 * Fetches one ahead of time. Cheap to call; does nothing when already loading or loaded,
 * which is what stops a screen that mounts repeatedly from spawning a preload loop.
 */
export const preloadInterstitial = (): void => {
  if (!adsConfig.enabled || !adsConfig.interstitialsEnabled) return;
  if (state === 'loading' || state === 'loaded' || state === 'showing') return;

  teardown();
  state = 'loading';

  const instance = InterstitialAd.createForAdRequest(adsConfig.units.interstitial, {
    requestNonPersonalizedAdsOnly: false,
  });
  ad = instance;

  unsubscribe.push(
    instance.addAdEventListener(AdEventType.LOADED, () => {
      state = 'loaded';
    }),
    instance.addAdEventListener(AdEventType.ERROR, () => {
      // Includes no-fill. Left failed rather than retried: a retry loop against an
      // unfilled unit is a battery drain and achieves nothing.
      state = 'failed';
      teardown();
    }),
    instance.addAdEventListener(AdEventType.CLOSED, () => {
      state = 'idle';
      teardown();
      // Fetch the next one only once this one is out of the way.
      preloadInterstitial();
    }),
  );

  instance.load();
};

/**
 * Shows one if — and only if — every rule allows it.
 *
 * Returns whether it was shown, so a caller can carry on regardless. It never awaits the
 * ad and never blocks navigation: the transition the user asked for happens either way.
 */
export const showInterstitialIfEligible = (): boolean => {
  if (!canShowInterstitial() || !ad) return false;

  state = 'showing';
  lastShownAt = Date.now();
  shownThisSession += 1;

  try {
    ad.show();
    return true;
  } catch {
    state = 'failed';
    teardown();
    return false;
  }
};

/** For tests and for a sign-out, which should not carry counters into the next account. */
export const resetInterstitialState = (): void => {
  teardown();
  state = 'idle';
  lastShownAt = 0;
  shownThisSession = 0;
};
