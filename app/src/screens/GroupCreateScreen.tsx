import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { groups as groupsApi } from '@/api/endpoints';
import { ApiError, describeError } from '@/api/errors';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { Card, SegmentedControl } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/theme/tokens';

export default function GroupCreateScreen() {
  const { colors, dark } = useTheme();
  const router = useRouter();
  const { mode: initialMode } = useLocalSearchParams<{ mode?: string }>();

  const [mode, setMode] = useState<'create' | 'join'>(initialMode === 'join' ? 'join' : 'create');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [invite, setInvite] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const inFlight = useRef(false);
  const problem = error ? describeError(error) : undefined;

  const open = (groupId: string): void => {
    router.replace(('/group/' + groupId) as never);
  };

  const create = async (): Promise<void> => {
    if (inFlight.current) return;
    if (!name.trim()) {
      setFieldErrors({ name: 'Give the group a name.' });
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setError(undefined);
    setFieldErrors({});

    try {
      const { group } = await groupsApi.create(name.trim(), description);
      open(group.id);
    } catch (caught: unknown) {
      setError(caught);
      if (caught instanceof ApiError && caught.fields) setFieldErrors(caught.fields);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const join = async (): Promise<void> => {
    if (inFlight.current) return;
    if (!invite.trim()) {
      setFieldErrors({ invite: 'Enter the invite code.' });
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setError(undefined);
    setFieldErrors({});

    try {
      const { group } = await groupsApi.join(invite.trim());
      open(group.id);
    } catch (caught: unknown) {
      setError(caught);
      if (caught instanceof ApiError && caught.fields) setFieldErrors(caught.fields);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScreenHeader title={mode === 'create' ? 'Create Group' : 'Join a Group'} />

      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <SegmentedControl
            options={[
              { value: 'create', label: 'Create New' },
              { value: 'join', label: 'Join with Code' },
            ]}
            value={mode}
            onChange={(next) => {
              setMode(next);
              setError(undefined);
              setFieldErrors({});
            }}
          />

          {mode === 'create' ? (
            <View
              style={[
                styles.formCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                !dark ? shadows.sm : null,
              ]}
            >
              <TextField
                label="Group Name"
                leftIcon="group"
                value={name}
                onChangeText={setName}
                error={fieldErrors.name}
                placeholder="Goa trip, Apartment 402, Flatmates"
                maxLength={80}
                autoFocus
                returnKeyType="next"
                editable={!submitting}
              />

              <TextField
                label="Description (optional)"
                value={description}
                onChangeText={setDescription}
                error={fieldErrors.description}
                placeholder="What is this group for?"
                maxLength={300}
                multiline
                editable={!submitting}
                style={styles.multiline}
              />

              {problem ? <Problem title={problem.title} message={problem.message} /> : null}

              <PrimaryButton
                label="Create Group"
                icon="add"
                loading={submitting}
                disabled={name.trim().length === 0}
                onPress={() => void create()}
              />

              <Text style={[styles.note, { color: colors.muted }]}>
                You will be the group creator. You can invite friends immediately after creating it with a share code.
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.formCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                !dark ? shadows.sm : null,
              ]}
            >
              <TextField
                label="Invite Code or Link"
                leftIcon="forward"
                value={invite}
                onChangeText={setInvite}
                error={fieldErrors.invite}
                placeholder="Paste invite code (e.g. AB12CD)"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                returnKeyType="go"
                editable={!submitting}
                onSubmitEditing={() => void join()}
              />

              {problem ? <Problem title={problem.title} message={problem.message} /> : null}

              <PrimaryButton
                label="Join Group"
                icon="group"
                loading={submitting}
                disabled={invite.trim().length === 0}
                onPress={() => void join()}
              />

              <Card>
                <View style={styles.hint}>
                  <Icon name="info" size={18} tone="primary" />
                  <Text style={{ color: colors.muted, fontSize: typography.caption, lineHeight: 18, flex: 1 }}>
                    Ask an existing group member to share the invite link or code. Codes can be regenerated by admins.
                  </Text>
                </View>
              </Card>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Problem({ title, message }: { title: string; message: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.alert,
        {
          backgroundColor: colors.destructiveLight,
          borderColor: colors.destructive,
        },
      ]}
    >
      <Icon name="alert" size={18} tone="danger" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.destructive, fontSize: typography.caption, fontWeight: '700' }}>
          {title}
        </Text>
        <Text style={{ color: colors.muted, fontSize: typography.xs, lineHeight: 16 }}>
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: {
    padding: spacing.base,
    gap: spacing.base,
    paddingBottom: spacing.xxl,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  formCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.base,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  note: { fontSize: typography.caption, lineHeight: 18, textAlign: 'center' },
  hint: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
