import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import mobileAds, {
  AdsConsent,
  AdsConsentDebugGeography,
  MaxAdContentRating,
} from 'react-native-google-mobile-ads';
import { adsConfig } from './config';

/**
 * Consent, initialisation, and whether an ad may be requested at all.
 *
 * ORDER MATTERS, AND IT IS THE ORDER GOOGLE DOCUMENTS
 *
 *   gatherConsent()  →  canRequestAds?  →  mobileAds().initialize()
 *
 * Consent is gathered first because in the EEA the SDK must not request a personalised
 * ad before the user has been asked. `gatherConsent` handles both halves — it asks the
 * UMP service whether a form is required and presents the real Google form if so. This is
 * deliberately NOT a hand-rolled dialog: a bespoke "do you accept cookies" sheet does not
 * satisfy the requirement and does not tell the SDK anything.
 *
 * NOTHING HERE BLOCKS THE APP
 *
 * Every step is fire-and-forget and every failure is swallowed into "ads are not
 * available". SplitMoney is an app for splitting bills; if Google is unreachable, the SDK
 * times out, or the user declines, the only correct consequence is that no advertisement
 * appears. The rest of the app must not notice, which is why this provider renders its
 * children immediately and never gates them on a promise.
 */

export type AdsStatus =
  | 'disabled'
  /** Working through consent and initialisation. */
  | 'preparing'
  /** SDK up and consent permits requesting ads. */
  | 'ready'
  /** Consent was refused, or the region requires consent that was not given. */
  | 'not-permitted'
  /** Something failed. Ads are simply off; the app is unaffected. */
  | 'error';

type AdsContextValue = {
  status: AdsStatus;
  /** The single question every ad component asks before rendering anything. */
  canShowAds: boolean;
  /**
   * Reserved for a future paid tier. Always false today.
   *
   * It exists now so that adding a subscription later is a change to this one function
   * rather than to every screen that renders a banner — the screens already ask.
   */
  hasAdFreeAccess: boolean;
  /** True when a privacy options form exists and may be offered in Settings. */
  privacyOptionsRequired: boolean;
  showPrivacyOptions: () => Promise<void>;
  /**
   * Height a displayed banner is currently occupying at the bottom of the screen, or 0.
   *
   * Published so floating UI can sit ABOVE the ad rather than on top of it. An overlaid
   * advertisement is not merely untidy: obscuring an ad invites accidental taps, which is
   * bad for the user and counts as invalid traffic against the AdMob account.
   */
  bannerHeight: number;
  setBannerHeight: (height: number) => void;
};

const AdsContext = createContext<AdsContextValue | null>(null);

export function AdProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AdsStatus>(
    adsConfig.enabled ? 'preparing' : 'disabled',
  );
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(false);
  const [bannerHeight, setBannerHeight] = useState(0);

  /** Initialisation must happen once per process, however often this remounts. */
  const started = useRef(false);

  useEffect(() => {
    if (!adsConfig.enabled || started.current) return;
    started.current = true;

    let cancelled = false;

    void (async () => {
      try {
        /*
         * Content rating and child-directed settings are applied before initialisation,
         * as the SDK requires. `G` is right for an expense splitter and keeps the
         * inventory tame.
         */
        await mobileAds().setRequestConfiguration({
          maxAdContentRating: MaxAdContentRating.G,
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
        });

        /*
         * In development the UMP service is told to behave as though the device were in
         * the EEA, so the consent form can actually be exercised. Without this a
         * developer outside Europe never sees the flow and never finds out it is broken.
         */
        await AdsConsent.requestInfoUpdate(
          adsConfig.useTestAds
            ? { debugGeography: AdsConsentDebugGeography.EEA, testDeviceIdentifiers: [] }
            : {},
        );

        // Presents the Google form when one is required; resolves immediately otherwise.
        const consent = await AdsConsent.gatherConsent();
        if (cancelled) return;

        setPrivacyOptionsRequired(Boolean(consent.privacyOptionsRequirementStatus === 'REQUIRED'));

        if (!consent.canRequestAds) {
          setStatus('not-permitted');
          return;
        }

        await mobileAds().initialize();
        if (cancelled) return;
        setStatus('ready');
      } catch {
        // Consent unavailable, SDK failure, no network. Ads off, app unaffected.
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Lets someone revisit their choice from Settings, as the UMP guidance requires. */
  const showPrivacyOptions = useCallback(async (): Promise<void> => {
    try {
      await AdsConsent.showPrivacyOptionsForm();
      const consent = await AdsConsent.getConsentInfo();
      setStatus(consent.canRequestAds ? 'ready' : 'not-permitted');
    } catch {
      // Nothing to do: their existing choice stands.
    }
  }, []);

  const hasAdFreeAccess = false;

  const value = useMemo<AdsContextValue>(
    () => ({
      status,
      canShowAds: adsConfig.enabled && status === 'ready' && !hasAdFreeAccess,
      hasAdFreeAccess,
      privacyOptionsRequired,
      showPrivacyOptions,
      bannerHeight,
      setBannerHeight,
    }),
    [status, privacyOptionsRequired, showPrivacyOptions, bannerHeight],
  );

  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}

/**
 * Safe to call from anywhere, including outside the provider.
 *
 * Returns "no ads" rather than throwing, because an ad is never important enough to crash
 * a screen over — and it means a screen can render a banner slot without caring whether
 * ads happen to be wired up in this build.
 */
export function useAds(): AdsContextValue {
  return (
    useContext(AdsContext) ?? {
      status: 'disabled',
      canShowAds: false,
      hasAdFreeAccess: false,
      privacyOptionsRequired: false,
      showPrivacyOptions: async () => {},
      bannerHeight: 0,
      setBannerHeight: () => {},
    }
  );
}
