import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar, Badge, Card, DetailRow, SectionHeader } from '@/components/ui';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/auth/AuthProvider';
import { isDurable } from '@/storage/secureStore';
import { runtime } from '@/constants/environment';
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

const formatDate = (iso: string | null): string => {
  if (!iso) return 'Not verified';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

export default function ProfileScreen() {
  const { colors, mode, setMode } = useTheme();
  const { user, permissions, signOut, refresh } = useAuth();

  const themeModes: { key: ThemeMode; label: string; icon: 'sun' | 'moon' | 'smartphone' }[] = [
    { key: 'system', label: 'System', icon: 'smartphone' },
    { key: 'light', label: 'Light', icon: 'sun' },
    { key: 'dark', label: 'Dark', icon: 'moon' },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Your Profile" />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* User Hero Card */}
        <Card style={styles.heroCard}>
          <Avatar name={user?.fullName ?? '?'} size={68} />
          <View style={styles.heroText}>
            <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}>
              {user?.fullName ?? 'User'}
            </Text>
            <Text style={{ color: colors.muted, fontSize: typography.bodySm }}>
              {user?.email ?? ''}
            </Text>
            <View style={styles.badgeRow}>
              <Badge
                label={user?.role === 'admin' ? 'Administrator' : 'Member'}
                tone={user?.role === 'admin' ? 'warning' : 'neutral'}
              />
              {user?.emailVerifiedAt ? (
                <Badge label="Verified Email" tone="positive" />
              ) : (
                <Badge label="Unverified" tone="warning" />
              )}
            </View>
          </View>
        </Card>

        {/* Account Details */}
        <Card>
          <SectionHeader title="Account Details" />
          <DetailRow label="Member Since" value={formatDate(user?.createdAt ?? null)} />
          <DetailRow label="Role" value={user?.role === 'admin' ? 'Administrator' : 'Member'} />
          <DetailRow label="Email Status" value={user?.emailVerifiedAt ? 'Verified' : 'Pending Verification'} />
          {permissions.length > 0 ? (
            <Text style={{ color: colors.muted, fontSize: typography.caption, paddingTop: spacing.xs }}>
              {permissions.length} server permissions granted.
            </Text>
          ) : null}
        </Card>

        {/* Appearance Card */}
        <Card>
          <SectionHeader title="Appearance" />
          <View style={styles.modes}>
            {themeModes.map((item) => {
              const selected = mode === item.key;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={item.label + ' theme'}
                  onPress={() => setMode(item.key)}
                  style={[
                    styles.modeButton,
                    {
                      backgroundColor: selected ? colors.primarySubtle : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Icon
                    name={item.icon}
                    size={18}
                    tone={selected ? 'primary' : 'muted'}
                  />
                  <Text
                    style={{
                      color: selected ? colors.primary : colors.text,
                      fontWeight: selected ? '700' : '500',
                      fontSize: typography.bodySm,
                    }}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: colors.muted, fontSize: typography.caption }}>
            Theme preference is stored on this device.
          </Text>
        </Card>

        {/* Device Diagnostics Card */}
        <Card>
          <SectionHeader title="Device & Environment" />
          <DetailRow
            label="Secure Storage"
            value={isDurable() ? 'Android Keystore' : 'In-Memory (Fallback)'}
            tone={isDurable() ? colors.success : colors.warning}
          />
          <DetailRow
            label="Version"
            value={'SplitMoney v' + (Constants.expoConfig?.version ?? '0.1.0') + ' (' + runtime.environment + ')'}
          />
          <View style={[styles.apiBox, { backgroundColor: colors.subtle }]}>
            <Text style={{ color: colors.muted, fontSize: typography.xs, fontWeight: '700' }}>API ENDPOINT</Text>
            <Text selectable style={{ color: colors.text, fontSize: typography.caption }}>
              {runtime.api.url ?? 'Set EXPO_PUBLIC_API_URL in .env.local'}
            </Text>
          </View>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <PrimaryButton
            label="Refresh Session"
            variant="secondary"
            icon="check"
            onPress={() => void refresh()}
          />
          <PrimaryButton
            label="Sign Out"
            variant="danger"
            icon="close"
            onPress={() => void signOut()}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 1.5,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  heroCard: {
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  heroText: {
    flex: 1,
    gap: spacing.xxs,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  modes: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
  },
  apiBox: {
    padding: spacing.md,
    borderRadius: radius.sm,
    gap: 2,
    marginTop: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
});
