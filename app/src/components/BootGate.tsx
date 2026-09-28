import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/theme/tokens';
import { Icon } from './Icon';
import { SMLogo, SMButton, SMCard } from './sm';

function Overlay({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: colors.background }]}>
      {children}
    </View>
  );
}

function Splash() {
  const { colors } = useTheme();
  return (
    <Overlay>
      <View style={styles.splashContent}>
        <SMLogo size="lg" showTagline align="center" />
        <ActivityIndicator
          size="small"
          color={colors.primary}
          style={styles.splashSpinner}
        />
      </View>
    </Overlay>
  );
}

function Reconnect() {
  const { colors, dark } = useTheme();
  const { refresh, signOut } = useAuth();

  return (
    <Overlay>
      <SMCard elevated style={styles.reconnectCard}>
        <View
          style={[
            styles.reconnectBadge,
            {
              backgroundColor: dark ? '#450A0A55' : '#FEF2F2',
              borderColor: dark ? '#991B1B' : '#FECACA',
            },
            !dark ? shadows.sm : null,
          ]}
        >
          <Icon name="alertCircle" size={28} tone="danger" />
        </View>

        <Text
          accessibilityRole="header"
          style={[styles.reconnectTitle, { color: colors.text }]}
        >
          Can&apos;t reach SplitMoney
        </Text>

        <Text style={[styles.reconnectDescription, { color: colors.muted }]}>
          You are still signed in on this device, but we could not confirm your session with the server. Please check your internet connection and try again.
        </Text>

        <View style={styles.actions}>
          <SMButton
            label="Try Again"
            icon="refresh"
            variant="primary"
            size="md"
            onPress={() => void refresh()}
          />
          <SMButton
            label="Sign Out"
            icon="signOut"
            variant="outline"
            size="md"
            onPress={() => void signOut()}
          />
        </View>
      </SMCard>
    </Overlay>
  );
}

export function BootGate({ themeReady }: { themeReady: boolean }) {
  const { status } = useAuth();
  if (status === 'restoring' || !themeReady) return <Splash />;
  if (status === 'unreachable') return <Reconnect />;
  return null;
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    zIndex: 999,
  },
  splashContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  splashSpinner: {
    marginTop: spacing.sm,
  },
  reconnectCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    maxWidth: 400,
    gap: spacing.md,
  },
  reconnectBadge: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxs,
  },
  reconnectTitle: {
    fontSize: typography.title,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  reconnectDescription: {
    fontSize: typography.bodySm,
    lineHeight: 22,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
