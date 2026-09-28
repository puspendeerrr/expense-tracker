import { useEffect, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { auth as authApi } from '@/api/endpoints';
import { ApiError, describeError } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { isDurable } from '@/storage/secureStore';
import { runtime } from '@/constants/environment';
import {
  SMAvatar,
  SMBadge,
  SMButton,
  SMCard,
  SMChipFilter,
  SMConfirmSheet,
  SMDetailRow,
  SMImagePicker,
  SMImageViewer,
  SMInlineNotice,
  SMScreenHeader,
  SMSelectField,
  SMSheet,
  SMTextInput,
} from '@/components/sm';
import { Icon } from '@/components/Icon';
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

/** Mirrors `upiIdSchema` and `fullNameSchema` on the server, for early feedback only. */
const UPI_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
const NAME_MIN = 2;
const NAME_MAX = 80;

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Match phone' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const memberSince = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

/**
 * You, and how people pay you.
 *
 * PAYMENT DETAILS COME FIRST AFTER YOUR NAME because they are what other people use: the
 * Settle Up screen reads your UPI ID to open their UPI app, and shows your QR when you have
 * no UPI ID. Without either, it can only tell them "hasn't added a UPI ID".
 *
 * What can be edited is exactly what the server accepts (`PATCH /auth/profile`): name,
 * UPI ID and payment QR. There is no profile photo — the account has no photo field — so
 * the avatar is your initials. Email and role are shown, not edited.
 *
 * After saving, the signed-in user is re-read from the server rather than patched locally,
 * so every screen shows what was actually stored.
 */
export default function ProfileScreen() {
  const { colors, mode, setMode } = useTheme();
  const { user, signOut, refresh, can } = useAuth();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [upi, setUpi] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; upiId?: string; form?: string }>({});
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [viewQr, setViewQr] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // The confirmation fades on its own; it is news, not a state to dismiss.
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 3500);
    return () => clearTimeout(timer);
  }, [saved]);

  const back = (): void => (router.canGoBack() ? router.back() : router.replace('/home'));

  const openEdit = (): void => {
    setName(user?.fullName ?? '');
    setUpi(user?.upiId ?? '');
    setQr(user?.qrCodeUrl ?? null);
    setErrors({});
    setEditing(true);
  };

  const save = async (): Promise<void> => {
    if (saving || !user) return;

    const trimmedName = name.trim();
    const trimmedUpi = upi.trim();
    const problems: typeof errors = {};
    if (trimmedName.length < NAME_MIN) problems.fullName = 'Your name needs at least ' + NAME_MIN + ' characters.';
    if (trimmedUpi && !UPI_PATTERN.test(trimmedUpi)) problems.upiId = 'That doesn’t look like a UPI ID — it should be like name@bank.';
    if (Object.keys(problems).length) {
      setErrors(problems);
      return;
    }

    // Only what changed, so an untouched field can never be overwritten by accident.
    const changes: { fullName?: string; upiId?: string; qrCodeUrl?: string } = {};
    if (trimmedName !== user.fullName) changes.fullName = trimmedName;
    if (trimmedUpi !== (user.upiId ?? '')) changes.upiId = trimmedUpi;
    if ((qr ?? '') !== (user.qrCodeUrl ?? '')) changes.qrCodeUrl = qr ?? '';

    if (Object.keys(changes).length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      await authApi.updateProfile(changes);
      await refresh();
      setEditing(false);
      setSaved(true);
    } catch (caught: unknown) {
      const fields = caught instanceof ApiError ? caught.fields ?? {} : {};
      setErrors({
        ...(fields.fullName ? { fullName: fields.fullName } : {}),
        ...(fields.upiId ? { upiId: fields.upiId } : {}),
        form: describeError(caught).message,
      });
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    Boolean(user) &&
    (name.trim() !== (user?.fullName ?? '') ||
      upi.trim() !== (user?.upiId ?? '') ||
      (qr ?? '') !== (user?.qrCodeUrl ?? ''));

  const copyUpi = async (): Promise<void> => {
    if (!user?.upiId) return;
    await Clipboard.setStringAsync(user.upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const hasUpi = Boolean(user?.upiId);
  const hasQr = Boolean(user?.qrCodeUrl);
  const durable = isDurable();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <SMScreenHeader title="Profile" onBack={back} />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await refresh();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ---- Who you are ---- */}
        <View style={styles.identity}>
          <SMAvatar name={user?.fullName ?? '?'} size={76} round />
          <Text accessibilityRole="header" style={[styles.name, { color: colors.text }]}>
            {user?.fullName ?? ''}
          </Text>
          <Text selectable style={[styles.email, { color: colors.muted }]}>
            {user?.email ?? ''}
          </Text>
          <View style={styles.badges}>
            {user?.emailVerifiedAt ? (
              <SMBadge label="Email verified" tone="success" icon="checkCircle" />
            ) : (
              <SMBadge label="Email not verified" tone="warning" icon="alertCircle" />
            )}
            {user?.role === 'admin' ? <SMBadge label="Administrator" tone="info" icon="shield" /> : null}
          </View>
          <SMButton label="Edit profile" icon="edit" variant="secondary" onPress={openEdit} style={styles.heroButton} />
        </View>

        {saved ? <SMInlineNotice type="success" message="Profile updated." /> : null}

        {/* ---- How people pay you ---- */}
        <Section title="How people pay you">
          <SMCard style={styles.payCard}>
            <View style={styles.upiRow}>
              <View style={styles.upiText}>
                <Text style={[styles.qrLabel, { color: colors.muted }]}>UPI ID</Text>
                <Text selectable numberOfLines={2} style={[styles.upiValue, { color: hasUpi ? colors.text : colors.muted }]}>
                  {hasUpi ? user?.upiId : 'Not added'}
                </Text>
              </View>
              {hasUpi ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copied ? 'UPI ID copied' : 'Copy UPI ID'}
                  onPress={() => void copyUpi()}
                  hitSlop={8}
                  style={({ pressed }) => [styles.copy, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Icon name={copied ? 'check' : 'copy'} size={14} tone="primary" />
                  <Text style={[styles.copyText, { color: colors.primary }]}>{copied ? 'Copied' : 'Copy'}</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Text style={[styles.qrLabel, { color: colors.muted }]}>Payment QR</Text>
            {hasQr ? (
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel="Payment QR code. Opens full screen."
                onPress={() => setViewQr(true)}
                style={({ pressed }) => [styles.qrFrame, { borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
              >
                {/* Always on white with a margin: a QR needs its quiet zone to scan. */}
                <Image source={{ uri: user?.qrCodeUrl as string }} style={styles.qrImage} resizeMode="contain" accessibilityIgnoresInvertColors />
                <View style={styles.qrHint}>
                  <Icon name="maximize" size={12} color="#475569" />
                  <Text style={styles.qrHintText}>Tap to enlarge</Text>
                </View>
              </Pressable>
            ) : (
              <View style={[styles.qrEmpty, { borderColor: colors.border }]}>
                <Icon name="image" size={20} tone="muted" />
                <Text style={[styles.qrEmptyTitle, { color: colors.text }]}>No payment QR added</Text>
                <Text style={[styles.qrEmptyText, { color: colors.muted }]}>
                  Add your UPI QR so friends can pay you even without your UPI ID.
                </Text>
                <SMButton label="Add QR" icon="add" variant="secondary" size="sm" onPress={openEdit} />
              </View>
            )}
          </SMCard>
          <Text style={[styles.note, { color: colors.muted }]}>
            Friends see these when they settle up with you. Adding them doesn’t record any payment.
          </Text>
        </Section>

        {/* ---- Appearance ---- */}
        <Section title="Appearance">
          <SMChipFilter accessibilityLabel="Theme" options={THEMES} value={mode} onChange={setMode} />
          <Text style={[styles.note, { color: colors.muted }]}>Saved on this phone.</Text>
        </Section>

        {/* ---- Account ---- */}
        <Section title="Account">
          <View style={styles.links}>
            <SMSelectField label="Notifications" value="What reaches this phone" icon="bell" onPress={() => router.push('/settings/notifications' as never)} />
            <SMSelectField label="Security" value="Password and sign-ins" icon="shield" onPress={() => router.push('/settings/security' as never)} />
            <SMSelectField label="Devices" value="Where you’re signed in" icon="smartphone" onPress={() => router.push('/settings/devices' as never)} />
            <SMSelectField label="Settings" value="Everything else" icon="settings" onPress={() => router.push('/settings' as never)} />
            {can('admin.access') ? (
              <SMSelectField label="Admin console" value="Platform users, groups and audit" icon="shield" onPress={() => router.push('/admin' as never)} />
            ) : null}
          </View>
        </Section>

        {/* ---- This phone ---- */}
        <Section title="This phone">
          <SMCard style={styles.card}>
            <SMDetailRow label="Member since" value={memberSince(user?.createdAt)} />
            <SMDetailRow
              label="Sign-in storage"
              value={durable ? 'Protected by Android Keystore' : 'Kept in memory only'}
              tone={durable ? colors.success : colors.warning}
            />
            <SMDetailRow label="App version" value={'SplitMoney ' + (Constants.expoConfig?.version ?? '')} />
            {__DEV__ ? (
              <SMDetailRow label="API (dev only)" value={runtime.api.url ?? 'not set'} />
            ) : null}
          </SMCard>
          {!durable ? (
            <SMInlineNotice
              type="warning"
              message="This phone couldn’t use secure storage, so you’ll need to sign in again each time the app restarts."
            />
          ) : null}
        </Section>

        <Pressable
          accessibilityRole="button"
          accessibilityHint="Asks for confirmation first"
          onPress={() => setConfirmSignOut(true)}
          style={({ pressed }) => [styles.signOut, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <Icon name="signOut" size={17} tone="destructive" />
          <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign out</Text>
        </Pressable>
      </ScrollView>

      {/* ---- Edit ---- */}
      <SMSheet
        visible={editing}
        onClose={() => setEditing(false)}
        title="Edit profile"
        footer={
          <SMButton label={dirty ? 'Save changes' : 'No changes'} loadingLabel="Saving…" variant="primary" fullWidth loading={saving} disabled={!dirty} onPress={() => void save()} />
        }
      >
        <View style={styles.form}>
          <SMTextInput
            label="Your name"
            required
            value={name}
            onChangeText={setName}
            maxLength={NAME_MAX}
            autoCapitalize="words"
            editable={!saving}
            {...(errors.fullName ? { error: errors.fullName } : {})}
          />
          <SMTextInput
            label="UPI ID"
            value={upi}
            onChangeText={setUpi}
            placeholder="name@bank"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            helperText="Friends’ UPI apps open with this filled in. Leave it empty to remove it."
            editable={!saving}
            {...(errors.upiId ? { error: errors.upiId } : {})}
          />
          <SMImagePicker
            variant="receipt"
            label="Payment QR"
            url={qr}
            onChange={(image) => setQr(image ? image.url : null)}
            helperText="Your UPI QR. Uploading it doesn’t save it — tap Save changes to keep it."
            disabled={saving}
          />
          {errors.form ? <SMInlineNotice type="error" message={errors.form} /> : null}
        </View>
      </SMSheet>

      <SMConfirmSheet
        visible={confirmSignOut}
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={async () => {
          setSigningOut(true);
          try {
            await signOut();
          } finally {
            setSigningOut(false);
            setConfirmSignOut(false);
          }
        }}
        loading={signingOut}
        icon="signOut"
        title="Sign out of SplitMoney?"
        description="You can sign back in anytime with your email and password. Your AI conversation on this phone will be cleared."
        confirmLabel="Sign out"
      />

      <SMImageViewer visible={viewQr} uri={user?.qrCodeUrl ?? null} title="Your payment QR" onClose={() => setViewQr(false)} />
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.muted }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: spacing.base, gap: spacing.lg, paddingBottom: spacing.xxl },
  identity: { alignItems: 'center', gap: spacing.xs, paddingTop: spacing.sm },
  name: { fontSize: typography.title, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center', marginTop: spacing.sm },
  email: { fontSize: typography.bodySm, textAlign: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xs },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: typography.xs, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  card: { paddingHorizontal: spacing.base, paddingVertical: spacing.xs },
  divider: { height: StyleSheet.hairlineWidth },
  qrLabel: { fontSize: typography.caption, fontWeight: '500' },
  heroButton: { marginTop: spacing.md, alignSelf: 'center' },
  payCard: { padding: spacing.base, gap: spacing.md },
  upiRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  upiText: { flex: 1, gap: 2 },
  upiValue: { fontSize: typography.body, fontWeight: '700' },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, minHeight: 36, borderWidth: 1, borderRadius: radius.pill },
  copyText: { fontSize: typography.caption, fontWeight: '700' },
  qrFrame: { alignSelf: 'center', width: 220, height: 244, borderRadius: radius.lg, borderWidth: 1, backgroundColor: '#FFFFFF', padding: spacing.base, alignItems: 'center' },
  qrImage: { width: 188, height: 188 },
  qrHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  qrHintText: { fontSize: typography.xs, fontWeight: '600', color: '#475569' },
  qrEmpty: { alignItems: 'center', gap: spacing.xs, padding: spacing.base, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.lg },
  qrEmptyTitle: { fontSize: typography.bodySm, fontWeight: '700' },
  qrEmptyText: { fontSize: typography.caption, textAlign: 'center', lineHeight: 18, marginBottom: spacing.xs },
  note: { fontSize: typography.xs },
  links: { gap: spacing.sm },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  signOutText: { fontSize: typography.bodySm, fontWeight: '700' },
  form: { gap: spacing.md },
});
