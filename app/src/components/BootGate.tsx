import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from './PrimaryButton';
import { Icon } from './Icon';
import { useAuth } from '@/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/theme/tokens';

function Overlay({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: colors.background }]}>
      {children}
    </View>
  );
}

function Splash() {
  const { colors, dark } = useTheme();
  return (
    <Overlay>
      <View
        style={[
          styles.mark,
          { backgroundColor: colors.primary },
          !dark ? shadows.md : null,
        ]}
      >
        <Text style={{ fontSize: typography.heroSm, fontWeight: '800', color: colors.onPrimary }}>
          S
        </Text>
      </View>
      <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.sm }} />
    </Overlay>
  );
}

function Reconnect() {
  const { colors } = useTheme();
  const { refresh, signOut } = useAuth();

  return (
    <Overlay>
      <View
        style={[
          styles.badge,
          { backgroundColor: colors.destructiveLight, borderColor: colors.destructive },
        ]}
      >
        <Icon name="alert" size={26} tone="danger" />
      </View>
      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: typography.titleSm, fontWeight: '700' }}
      >
        Can&apos;t reach SplitMoney
      </Text>
      <Text style={[styles.body, { color: colors.muted }]}>
        You are still signed in on this device, but we could not confirm it with the server.
        Check your connection and try again.
      </Text>
      <View style={styles.actions}>
        <PrimaryButton label="Try again" icon="refresh" onPress={() => void refresh()} />
        <PrimaryButton label="Sign out" variant="secondary" onPress={() => void signOut()} />
      </View>
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
  overlay: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  mark: {
    width: 68,
    height: 68,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
  },
  actions: { alignSelf: 'stretch', gap: spacing.sm, maxWidth: 300, width: '100%', marginTop: spacing.sm },
});
