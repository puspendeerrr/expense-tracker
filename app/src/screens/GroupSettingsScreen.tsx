import { useCallback, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { groups as groupsApi } from '@/api/endpoints';
import { describeError } from '@/api/errors';
import type { GroupShareInfo, MediaPair } from '@/api/types';
import type { UploadResult } from '@/lib/upload';
import { useRequest } from '@/hooks/useRequest';
import { useGroup } from '@/features/group/GroupContext';
import { canEditGroup } from '@/features/group/permissions';
import {
  SMButton,
  SMCard,
  SMConfirmSheet,
  SMDetailRow,
  SMErrorState,
  SMImagePicker,
  SMInlineNotice,
  SMRowSkeleton,
  SMScreenHeader,
  SMSelectField,
  SMSheet,
  SMTextInput,
} from '@/components/sm';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { formatPaise } from '@/lib/money';

/** An upload result as the media endpoint's pair, or the pair that clears the slot. */
const toPair = (image: UploadResult | null): MediaPair =>
  image ? { url: image.url, publicId: image.publicId } : { url: null, publicId: null };

/**
 * Group settings.
 *
 * ONE SCREEN, TWO AUDIENCES. The creator sees how the group looks and what it is called,
 * and can change both. Everyone else sees the same information as plain facts — not as
 * greyed-out controls. The previous screen drew the name as a disabled row captioned
 * "Managed by group creator", which is a button that exists only to refuse you. A member
 * who cannot rename the group has no use for a control that says so; they need the name.
 *
 * Visibility is decided by `canEditGroup`, the viewer's membership role. The server checks
 * the same role (`requireGroupCreator`) on every one of these writes, and that check is the
 * real boundary — hiding the controls only spares members a request that would be refused.
 *
 * NO SYSTEM ALERTS. Failures are shown inline where the action was taken, and the two
 * confirmations — regenerating the invite code and leaving — are SplitMoney sheets.
 */
export default function GroupSettingsScreen() {
  const { colors, dark } = useTheme();
  const { groupId, detail, live, refresh } = useGroup();
  const router = useRouter();

  const group = detail?.group;
  const editable = canEditGroup(group);

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  const [paydayOpen, setPaydayOpen] = useState(false);
  const [savingPayday, setSavingPayday] = useState<number | 'none' | null>(null);
  const [paydayError, setPaydayError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const share = useRequest<GroupShareInfo>(
    useCallback((signal: AbortSignal) => groupsApi.share(groupId, signal), [groupId]),
    [groupId],
  );

  const owe = live?.balances.youNeedToPayTotal.paise ?? 0;
  const owed = live?.balances.youWillReceiveTotal.paise ?? 0;
  const entangled = owe > 0 || owed > 0;

  /* ---- Creator: payday ---- */

  /*
   * Saves as soon as a day is picked. Only the day is stored; the server works out the
   * billing cycle from it (including short months), so nothing here does date maths.
   */
  const savePayday = async (day: number | null): Promise<void> => {
    if (savingPayday !== null) return;
    setSavingPayday(day ?? 'none');
    setPaydayError(null);
    try {
      await groupsApi.setPayday(groupId, day);
      await refresh();
      setPaydayOpen(false);
    } catch (caught: unknown) {
      setPaydayError(describeError(caught).message);
    } finally {
      setSavingPayday(null);
    }
  };

  /* ---- Creator: delete ---- */

  const deleteGroup = async (): Promise<void> => {
    if (deleting || !group) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await groupsApi.remove(groupId);
      setDeleteOpen(false);
      // Replace, so Back cannot return into a group that no longer exists.
      router.replace('/home');
    } catch (caught: unknown) {
      setDeleteError(describeError(caught).message);
    } finally {
      setDeleting(false);
    }
  };

  const back = (): void =>
    router.canGoBack() ? router.back() : router.replace(('/group/' + groupId) as never);

  /* ---- Creator: images ---- */

  /*
   * Called by the picker once Cloudinary has the file. Registering it with the server is
   * part of the same step, so if the server refuses, the picker shows the failure and keeps
   * the chosen image for Retry. The group is then re-read from the server, so the new image
   * appears everywhere it is shown without anybody reloading.
   */
  const saveMedia = async (slot: 'avatar' | 'cover', image: UploadResult | null): Promise<void> => {
    await groupsApi.setMedia(groupId, { [slot]: toPair(image) });
    await refresh();
  };

  /* ---- Creator: name and description ---- */

  const openEdit = (): void => {
    setName(group?.name ?? '');
    setDescription(group?.description ?? '');
    setEditError(null);
    setEditOpen(true);
  };

  const saveDetails = async (): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setEditError(null);
    try {
      await groupsApi.update(groupId, {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : { description: null }),
      });
      await refresh();
      setEditOpen(false);
    } catch (caught: unknown) {
      // Input is kept, so a refusal can be corrected rather than retyped.
      setEditError(describeError(caught).message);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  /* ---- Creator: invite code ---- */

  const regenerate = async (): Promise<void> => {
    if (regenerating) return;
    setRegenerating(true);
    setRegenerateError(null);
    try {
      await groupsApi.regenerateInvite(groupId);
      await share.refresh();
      setConfirmRegenerate(false);
    } catch (caught: unknown) {
      setRegenerateError(describeError(caught).message);
    } finally {
      setRegenerating(false);
    }
  };

  /* ---- Everyone ---- */

  const leave = async (): Promise<void> => {
    if (leaving) return;
    setLeaving(true);
    setLeaveError(null);
    try {
      await groupsApi.leave(groupId);
      setConfirmLeave(false);
      router.replace('/home');
    } catch (caught: unknown) {
      // The server owns the rule about unsettled balances; its sentence is the one to show.
      setLeaveError(describeError(caught).message);
    } finally {
      setLeaving(false);
    }
  };

  const copyInvite = async (): Promise<void> => {
    const code = share.data?.inviteCode;
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const shareInvite = async (): Promise<void> => {
    const code = share.data?.inviteCode;
    if (!code || !group) return;
    try {
      await Share.share({
        message:
          'Join "' + group.name + '" on SplitMoney.\n\nInvite code: ' + code +
          '\n\nOr open: splitmoney://join/' + code,
      });
    } catch {
      // Dismissing the share sheet is not an error.
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <SMScreenHeader
        title={editable ? 'Group settings' : 'Group info'}
        {...(group?.name ? { subtitle: group.name } : {})}
        onBack={back}
      />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* ---- Creator only: how the group looks ---- */}
        {editable ? (
          <Section title="Appearance">
            <SMImagePicker
              variant="cover"
              label="Cover image"
              url={group?.coverUrl ?? null}
              onChange={(image) => saveMedia('cover', image)}
              helperText="Shown across the top of the group. A wide landscape photo works best."
            />
            <SMImagePicker
              variant="avatar"
              label="Group photo"
              url={group?.avatarUrl ?? null}
              onChange={(image) => saveMedia('avatar', image)}
              helperText="Shown next to the group’s name everywhere. A square photo works best."
            />
          </Section>
        ) : null}

        {/* ---- Name and description: editable for the creator, facts for everyone else ---- */}
        <Section title="Details">
          {editable ? (
            <>
              <SMSelectField
                label="Name"
                value={group?.name ?? '—'}
                icon="edit"
                onPress={openEdit}
              />
              <SMSelectField
                label="Description"
                value={group?.description ? group.description : 'Add a description'}
                icon="file-text"
                onPress={openEdit}
              />
            </>
          ) : (
            <SMCard style={styles.infoCard}>
              <SMDetailRow label="Name" value={group?.name ?? '—'} />
              {group?.description ? (
                <SMDetailRow label="About" value={group.description} />
              ) : null}
              <SMDetailRow label="Currency" value={group?.currency ?? 'INR'} />
            </SMCard>
          )}

          <SMSelectField
            label="Members"
            value={(detail?.members.length ?? 0) + ' people'}
            icon="users"
            onPress={() => router.push(('/group/' + groupId + '/members') as never)}
          />
        </Section>

        {/* ---- Invite: everyone can share it; only the creator can reset it ---- */}
        <Section title="Invite people">
          {share.loading && !share.data ? (
            <SMRowSkeleton rows={1} />
          ) : share.error && !share.data ? (
            <SMErrorState error={share.error} onRetry={() => void share.refresh()} />
          ) : (
            <SMCard style={styles.inviteCard}>
              <Text style={[styles.inviteLabel, { color: colors.muted }]}>Invite code</Text>
              <Text
                selectable
                accessibilityLabel={
                  'Invite code ' + (share.data?.inviteCode ?? '').split('').join(' ')
                }
                style={[styles.inviteCode, { color: colors.text }]}
              >
                {share.data?.inviteCode ?? '—'}
              </Text>
              <View style={styles.inviteActions}>
                <SMButton
                  label={copied ? 'Copied' : 'Copy code'}
                  icon={copied ? 'check' : 'copy'}
                  variant="secondary"
                  onPress={() => void copyInvite()}
                  style={styles.half}
                />
                <SMButton
                  label="Share invite"
                  icon="send"
                  variant="primary"
                  onPress={() => void shareInvite()}
                  style={styles.half}
                />
              </View>

              {editable ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint="Asks for confirmation first"
                  onPress={() => {
                    setRegenerateError(null);
                    setConfirmRegenerate(true);
                  }}
                  hitSlop={8}
                  style={({ pressed }) => [styles.regenerate, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Icon name="refresh" size={14} tone="primary" />
                  <Text style={[styles.regenerateText, { color: colors.primary }]}>
                    Generate a new code
                  </Text>
                </Pressable>
              ) : null}
            </SMCard>
          )}
        </Section>

        {/* ---- Creator only: billing cycle ---- */}
        {editable ? (
          <Section title="Billing cycle">
            <SMSelectField
              label="Payday"
              value={group?.payday ? ordinal(group.payday) + ' of each month' : 'Not set'}
              detail="The day your group’s monthly spending resets"
              icon="calendar"
              onPress={() => {
                setPaydayError(null);
                setPaydayOpen(true);
              }}
            />
          </Section>
        ) : null}

        {/* ---- Leaving ---- */}
        <Section title="Leave">
          {entangled ? (
            <SMInlineNotice
              type="warning"
              title="You have money outstanding here"
              message={
                (owe > 0 && owed > 0
                  ? 'You owe ' + formatPaise(owe, { compact: true }) + ', and ' +
                    formatPaise(owed, { compact: true }) + ' is owed to you.'
                  : owe > 0
                    ? 'You owe ' + formatPaise(owe, { compact: true }) + '.'
                    : 'You are owed ' + formatPaise(owed, { compact: true }) + '.') +
                ' Settle up before leaving.'
              }
            />
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityHint="Asks for confirmation first"
            onPress={() => {
              setLeaveError(null);
              setConfirmLeave(true);
            }}
            style={({ pressed }) => [
              styles.leaveRow,
              {
                borderColor: dark ? colors.borderStrong : colors.border,
                backgroundColor: pressed
                  ? colors.destructiveLight
                  : dark
                    ? colors.surface
                    : colors.surfaceElevated ?? colors.surface,
              },
            ]}
          >
            <View style={[styles.leaveIcon, { backgroundColor: colors.destructiveLight }]}>
              <Icon name="signOut" size={16} tone="destructive" />
            </View>
            <View style={styles.leaveBody}>
              <Text style={[styles.leaveTitle, { color: colors.destructive }]}>Leave group</Text>
              <Text style={[styles.leaveDetail, { color: colors.muted }]}>
                Remove yourself from this group
              </Text>
            </View>
          </Pressable>
        </Section>

        {editable ? (
          <Section title="Danger zone">
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Asks you to confirm by typing the group’s name"
              onPress={() => {
                setDeleteText('');
                setDeleteError(null);
                setDeleteOpen(true);
              }}
              style={({ pressed }) => [
                styles.leaveRow,
                {
                  borderColor: dark ? colors.borderStrong : colors.border,
                  backgroundColor: pressed ? colors.destructiveLight : dark ? colors.surface : colors.surfaceElevated ?? colors.surface,
                },
              ]}
            >
              <View style={[styles.leaveIcon, { backgroundColor: colors.destructiveLight }]}>
                <Icon name="trash" size={16} tone="destructive" />
              </View>
              <View style={styles.leaveBody}>
                <Text style={[styles.leaveTitle, { color: colors.destructive }]}>Delete group</Text>
                <Text style={[styles.leaveDetail, { color: colors.muted }]}>
                  Removes it and all its records for everyone
                </Text>
              </View>
            </Pressable>
          </Section>
        ) : null}

        <Text style={[styles.note, { color: colors.muted }]}>
          {editable
            ? 'You are this group’s creator. Handing the role to someone else is done by a SplitMoney administrator.'
            : 'Only the group’s creator can change its name, photo or cover.'}
        </Text>
      </ScrollView>

      {/* ---- Creator: edit name and description ---- */}
      <SMSheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit group"
        footer={
          <SMButton
            label="Save changes"
            loadingLabel="Saving…"
            variant="primary"
            fullWidth
            loading={saving}
            disabled={name.trim().length < 2}
            onPress={() => void saveDetails()}
          />
        }
      >
        <View style={styles.sheetFields}>
          <SMTextInput
            label="Group name"
            required
            value={name}
            onChangeText={setName}
            // groupNameSchema: 2–60.
            maxLength={60}
            autoFocus
            returnKeyType="next"
            editable={!saving}
          />
          <SMTextInput
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="What is this group for?"
            // groupDescriptionSchema: up to 280.
            maxLength={280}
            multiline
            editable={!saving}
            style={styles.multiline}
          />
          {editError ? <SMInlineNotice type="error" message={editError} /> : null}
        </View>
      </SMSheet>

      <SMConfirmSheet
        visible={confirmRegenerate}
        onCancel={() => setConfirmRegenerate(false)}
        onConfirm={() => void regenerate()}
        loading={regenerating}
        icon="refresh"
        title="Generate a new invite code?"
        description="The current code stops working straight away. Anyone who has it will need the new one to join."
        errorMessage={regenerateError}
        confirmLabel="Generate new code"
      />

      <SMConfirmSheet
        visible={confirmLeave}
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => void leave()}
        destructive
        loading={leaving}
        icon="signOut"
        title={'Leave ' + (group?.name ?? 'this group') + '?'}
        description="You will no longer see this group’s expenses or balances. Someone in the group can invite you back."
        {...(entangled
          ? {
              detail:
                'You still have money outstanding here. The server will refuse to let you leave until it is settled.',
            }
          : {})}
        errorMessage={leaveError}
        confirmLabel="Leave group"
      />
      {/* ---- Payday picker ---- */}
      <SMSheet
        visible={paydayOpen}
        onClose={() => setPaydayOpen(false)}
        title="Payday"
        subtitle="Pick the day each month when the group’s spending resets."
      >
        <View style={styles.dayGrid}>
          {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => {
            const on = group?.payday === day;
            return (
              <Pressable
                key={day}
                accessibilityRole="radio"
                accessibilityLabel={ordinal(day)}
                accessibilityState={{ selected: on, checked: on, busy: savingPayday === day }}
                disabled={savingPayday !== null}
                onPress={() => void savePayday(day)}
                style={({ pressed }) => [
                  styles.day,
                  {
                    backgroundColor: on ? colors.primary : pressed ? colors.primarySubtle ?? colors.subtle : 'transparent',
                    borderColor: on ? colors.primary : dark ? colors.borderStrong : colors.border,
                    opacity: savingPayday !== null && savingPayday !== day ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={[styles.dayText, { color: on ? colors.onPrimary ?? '#FFFFFF' : colors.text }]}>
                  {savingPayday === day ? '…' : String(day)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.dayNote, { color: colors.muted }]}>
          In shorter months, days after the last day count as the last day.
        </Text>
        {group?.payday ? (
          <SMButton
            label="No payday"
            variant="secondary"
            loading={savingPayday === 'none'}
            onPress={() => void savePayday(null)}
          />
        ) : null}
        {paydayError ? <SMInlineNotice type="error" message={paydayError} /> : null}
      </SMSheet>

      {/* ---- Delete, with the name typed out ---- */}
      <SMSheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={'Delete ' + (group?.name ?? 'this group') + '?'}
        footer={
          <View style={styles.sheetActions}>
            <SMButton label="Keep the group" variant="primary" fullWidth onPress={() => setDeleteOpen(false)} />
            <SMButton
              label="Delete group"
              loadingLabel="Deleting…"
              variant="danger"
              fullWidth
              loading={deleting}
              disabled={deleteText.trim() !== (group?.name ?? '').trim()}
              onPress={() => void deleteGroup()}
            />
          </View>
        }
      >
        <View style={styles.sheetFields}>
          <SMInlineNotice
            type="error"
            title="This can’t be undone"
            message="The group is deleted for everyone, together with all of its expenses, payments, balances and activity. Nothing is kept."
          />
          <SMTextInput
            label={'Type “' + (group?.name ?? '') + '” to confirm'}
            value={deleteText}
            onChangeText={setDeleteText}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!deleting}
          />
          {deleteError ? <SMInlineNotice type="error" message={deleteError} /> : null}
        </View>
      </SMSheet>
    </SafeAreaView>
  );
}

/** 1 -> "1st", 22 -> "22nd". */
const ordinal = (n: number): string => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return n + 'th';
  return n + (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.muted }]}>
        {title}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: spacing.base, gap: spacing.lg, paddingBottom: spacing.xxl },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: typography.xs,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  sectionBody: { gap: spacing.md },
  infoCard: { paddingHorizontal: spacing.base, paddingVertical: spacing.xs },
  inviteCard: { padding: spacing.base, gap: spacing.sm, alignItems: 'center' },
  inviteLabel: { fontSize: typography.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  inviteCode: {
    fontSize: typography.heroSm,
    fontWeight: '900',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
    paddingVertical: spacing.xs,
  },
  inviteActions: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' },
  half: { flex: 1 },
  regenerate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    minHeight: 36,
  },
  regenerateText: { fontSize: typography.caption, fontWeight: '700' },
  leaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    minHeight: 64,
  },
  leaveIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBody: { flex: 1, gap: 1 },
  leaveTitle: { fontSize: typography.bodySm, fontWeight: '700' },
  leaveDetail: { fontSize: typography.caption },
  note: { fontSize: typography.caption, lineHeight: 18, textAlign: 'center' },
  sheetFields: { gap: spacing.md },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: spacing.sm },
  day: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: typography.bodySm, fontWeight: '700' },
  dayNote: { fontSize: typography.caption, lineHeight: 18, paddingBottom: spacing.sm },
  sheetActions: { gap: spacing.sm },
});
