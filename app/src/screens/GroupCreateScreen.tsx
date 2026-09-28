import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { groups as groupsApi } from '@/api/endpoints';
import { ApiError, describeError } from '@/api/errors';
import type { InvitePreview } from '@/api/types';
import {
  SMButton,
  SMCard,
  SMChipFilter,
  SMInlineNotice,
  SMScreenHeader,
  SMTextInput,
} from '@/components/sm';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';

/** Mirrors groupNameSchema / groupDescriptionSchema, for early feedback only. */
const NAME_MIN = 2;
const NAME_MAX = 60;
const DESCRIPTION_MAX = 280;

type Mode = 'create' | 'join';

/**
 * The invite credential inside whatever was pasted — a code, or a link containing
 * /join/<code>. The SAME rule the server's join schema applies (inviteCredentialSchema).
 * The preview endpoint does not apply it, so without this a pasted link would fail the
 * preview while the very same link would have joined fine.
 */
const credentialOf = (value: string): string => {
  const trimmed = value.trim();
  const match = /\/join\/([^/?#\s]+)/.exec(trimmed);
  return match?.[1] ? decodeURIComponent(match[1]) : trimmed;
};

/**
 * Start a group, or join one.
 *
 * Nothing is created or joined on the phone: both go to the server, and only its answer
 * opens the group. Inputs survive a failure so they can be corrected rather than retyped.
 *
 * JOINING PREVIEWS FIRST. The invite is checked with the public preview endpoint, which
 * returns only the group's name, description and size — nothing financial — and the
 * person confirms before joining. The invite can be a code or a pasted link; the server
 * pulls the credential out of either, so nothing here reformats it.
 */
export default function GroupCreateScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { mode: initialMode } = useLocalSearchParams<{ mode?: string }>();

  const [mode, setMode] = useState<Mode>(initialMode === 'join' ? 'join' : 'create');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [invite, setInvite] = useState('');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const inFlight = useRef(false);

  const back = (): void => (router.canGoBack() ? router.back() : router.replace('/home'));
  // Replace, so Back from the new group returns Home rather than to this form.
  const open = (groupId: string): void => router.replace(('/group/' + groupId) as never);

  /** One request at a time; the form keeps its values whatever happens. */
  const guarded = async (fn: () => Promise<void>): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setProblem(null);
    setFieldErrors({});
    try {
      await fn();
    } catch (caught: unknown) {
      setProblem(describeError(caught).message);
      if (caught instanceof ApiError && caught.fields) setFieldErrors(caught.fields);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const create = (): void => {
    if (name.trim().length < NAME_MIN) {
      setFieldErrors({ name: 'Give the group a name of at least ' + NAME_MIN + ' characters.' });
      return;
    }
    void guarded(async () => {
      const { group } = await groupsApi.create(name.trim(), description);
      open(group.id);
    });
  };

  const check = (): void => {
    if (!invite.trim()) {
      setFieldErrors({ invite: 'Enter the invite code or link.' });
      return;
    }
    void guarded(async () => {
      setPreview(await groupsApi.previewInvite(credentialOf(invite)));
    });
  };

  const join = (): void => {
    void guarded(async () => {
      const { group } = await groupsApi.join(credentialOf(invite));
      open(group.id);
    });
  };

  const switchMode = (next: Mode): void => {
    setMode(next);
    setProblem(null);
    setFieldErrors({});
  };


  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
      <SMScreenHeader title={mode === 'create' ? 'New group' : 'Join a group'} onBack={back} variant="close" />

      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <SMChipFilter
            accessibilityLabel="Create or join"
            options={[
              { value: 'create', label: 'Create a group' },
              { value: 'join', label: 'Join with a code' },
            ]}
            value={mode}
            onChange={switchMode}
          />

          {mode === 'create' ? (
            <View style={styles.form}>
              <Text style={[styles.lead, { color: colors.muted }]}>
                For flatmates, a trip, a household — anyone you share costs with. You’ll be its creator.
              </Text>
              <SMTextInput
                label="Group name"
                required
                value={name}
                onChangeText={setName}
                placeholder="e.g. Apartment 402"
                maxLength={NAME_MAX}
                autoCapitalize="words"
                returnKeyType="next"
                editable={!submitting}
                {...(fieldErrors.name ? { error: fieldErrors.name } : {})}
              />
              <SMTextInput
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="What is this group for? (optional)"
                maxLength={DESCRIPTION_MAX}
                multiline
                editable={!submitting}
                style={styles.multiline}
                {...(fieldErrors.description ? { error: fieldErrors.description } : {})}
              />
              <Text style={[styles.hint, { color: colors.muted }]}>
                You can add a photo and cover once the group exists.
              </Text>
            </View>
          ) : preview ? (
            <SMCard style={styles.preview}>
              <View style={[styles.previewIcon, { backgroundColor: colors.primarySubtle ?? colors.subtle }]}>
                <Icon name="group" size={22} tone="primary" />
              </View>
              <Text style={[styles.previewLabel, { color: colors.muted }]}>You’re invited to</Text>
              <Text style={[styles.previewName, { color: colors.text }]}>{preview.groupName}</Text>
              {preview.description ? (
                <Text style={[styles.previewText, { color: colors.muted }]}>{preview.description}</Text>
              ) : null}
              <Text style={[styles.previewText, { color: colors.muted }]}>
                {preview.memberCount + (preview.memberCount === 1 ? ' member' : ' members')}
              </Text>
              {preview.isAlreadyMember ? (
                <SMInlineNotice type="info" message="You’re already a member of this group." />
              ) : null}
              <SMButton
                label="Use a different code"
                variant="ghost"
                onPress={() => setPreview(null)}
              />
            </SMCard>
          ) : (
            <View style={styles.form}>
              <Text style={[styles.lead, { color: colors.muted }]}>
                Paste the invite code or link someone shared with you.
              </Text>
              <SMTextInput
                label="Invite code or link"
                value={invite}
                onChangeText={(value) => {
                  setInvite(value);
                  setPreview(null);
                }}
                placeholder="e.g. ABC123"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={check}
                maxLength={512}
                editable={!submitting}
                style={styles.code}
                {...(fieldErrors.invite ? { error: fieldErrors.invite } : {})}
              />
            </View>
          )}

          {problem ? <SMInlineNotice type="error" message={problem} /> : null}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          {mode === 'create' ? (
            <SMButton
              label="Create group"
              loadingLabel="Creating…"
              icon="add"
              variant="primary"
              fullWidth
              loading={submitting}
              disabled={name.trim().length < NAME_MIN}
              onPress={create}
            />
          ) : preview ? (
            preview.isAlreadyMember ? (
              <SMButton label="Open group" variant="primary" fullWidth onPress={() => open(preview.groupId)} />
            ) : (
              <SMButton
                label={'Join ' + preview.groupName}
                loadingLabel="Joining…"
                icon="userPlus"
                variant="primary"
                fullWidth
                loading={submitting}
                onPress={join}
              />
            )
          ) : (
            <SMButton
              label="Continue"
              loadingLabel="Checking…"
              variant="primary"
              fullWidth
              loading={submitting}
              disabled={!invite.trim()}
              onPress={check}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: spacing.base, gap: spacing.lg, paddingBottom: spacing.xxl },
  form: { gap: spacing.md },
  lead: { fontSize: typography.bodySm, lineHeight: 21 },
  hint: { fontSize: typography.caption },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  code: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', letterSpacing: 1 },
  preview: { padding: spacing.lg, alignItems: 'center', gap: spacing.xs },
  previewIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  previewLabel: { fontSize: typography.caption, fontWeight: '600' },
  previewName: { fontSize: typography.title, fontWeight: '800', textAlign: 'center' },
  previewText: { fontSize: typography.bodySm, textAlign: 'center' },
  footer: { paddingHorizontal: spacing.base, paddingVertical: spacing.md, borderTopWidth: 1 },
});
