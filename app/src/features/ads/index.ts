/**
 * The ads layer's public surface.
 *
 * Screens import from here and nowhere else — no screen imports
 * `react-native-google-mobile-ads` directly. That is what keeps the placement rules
 * enforceable: swapping the provider, disabling ads, or adding a paid tier is a change
 * inside this folder rather than a search across the app.
 */
export { AdProvider, useAds } from './AdProvider';
export { AdBanner } from './AdBanner';
export { AD_PLACEMENTS, adsConfig, type AdPlacement } from './config';
export {
  canShowInterstitial,
  preloadInterstitial,
  showInterstitialIfEligible,
  resetInterstitialState,
} from './interstitial';
