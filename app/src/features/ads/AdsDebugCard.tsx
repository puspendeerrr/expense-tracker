import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAds } from './AdProvider';
import { adsConfig } from './config';
import { getInterstitialState } from './interstitial';
import { Card } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

function maskAdId(id: string | undefined): string {
  if (!id) return '(none)';
  if (id.length <= 16) return id;
  const prefix = id.slice(0, 15);
  const suffix = id.slice(-6);
  return `${prefix}...${suffix}`;
}

/**
 * Dev-only debugging card for inspecting the AdMob integration.
 * NEVER renders in production builds (__DEV__ false and non-dev environment).
 */
export function AdsDebugCard() {
  const { colors } = useTheme();
  const { status, canShowAds, canRequestAds, bannerHeight, lastBannerError } = useAds();
  const interstitial = getInterstitialState();

  // Strict guard: Dev only
  if (!__DEV__ && adsConfig.environment === 'production') {
    return null;
  }

  const rows = [
    { label: 'Ads Enabled', value: adsConfig.enabled ? 'true' : 'false' },
    { label: 'Environment', value: adsConfig.environment },
    { label: 'Using Test Ads', value: adsConfig.useTestAds ? 'true' : 'false' },
    { label: 'App ID', value: maskAdId(adsConfig.appId) },
    { label: 'Banner Unit ID', value: maskAdId(adsConfig.units.banner) },
    { label: 'Interstitial Unit ID', value: maskAdId(adsConfig.units.interstitial) },
    { label: 'SDK Status', value: status },
    { label: 'SDK Initialized', value: status === 'ready' ? 'YES' : 'NO' },
    { label: 'canRequestAds', value: canRequestAds ? 'true' : 'false' },
    { label: 'canShowAds', value: canShowAds ? 'true' : 'false' },
    { label: 'Banner Height', value: `${bannerHeight}dp` },
    { label: 'Last Banner Error', value: lastBannerError ?? 'None / No error recorded' },
    { label: 'Interstitials Enabled', value: adsConfig.interstitialsEnabled ? 'true' : 'false' },
    { label: 'Interstitial State', value: interstitial.state },
    { label: 'Interstitials Shown', value: `${interstitial.shownThisSession} / ${interstitial.maxPerSession}` },
  ];

  return (
    <Card style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>AdMob Diagnostic Monitor</Text>
        <View style={[styles.badge, { backgroundColor: colors.subtle }]}>
          <Text style={[styles.badgeText, { color: colors.muted }]}>DEV ONLY</Text>
        </View>
      </View>

      <View style={styles.table}>
        {rows.map((row) => (
          <View key={row.label} style={[styles.row, { borderBottomColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.muted }]}>{row.label}</Text>
            <Text style={[styles.value, { color: colors.text }]} numberOfLines={2}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.xs,
  },
  title: {
    fontSize: typography.bodySm,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  badgeText: {
    fontSize: typography.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  table: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: typography.caption,
    fontWeight: '500',
    flex: 1,
  },
  value: {
    fontSize: typography.caption,
    fontWeight: '600',
    flex: 1.2,
    textAlign: 'right',
  },
});

