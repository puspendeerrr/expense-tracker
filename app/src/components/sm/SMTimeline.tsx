import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';

export type SMTimelineStepState = 'done' | 'current' | 'upcoming' | 'failed';

export type SMTimelineStep = {
  key: string;
  label: string;
  /** A date, a reason — only ever something the data actually holds. */
  detail?: string;
  state: SMTimelineStepState;
};

export type SMTimelineProps = { steps: SMTimelineStep[] };

/**
 * A short vertical history.
 *
 * THE FOUR MARKS MEAN FOUR DIFFERENT THINGS, and each is drawn differently rather than
 * just recoloured: a filled check for what happened, a ringed dot for where things stand,
 * an empty ring for what has not happened yet, and a cross for a step that failed. An
 * upcoming step is never drawn as done — a timeline that shows "Confirmed" ticked before
 * anyone confirmed is worse than no timeline.
 *
 * This component only draws the steps it is given. Deciding which steps exist, and what
 * dates they carry, belongs to the caller, which has the data.
 */
export function SMTimeline({ steps }: SMTimelineProps) {
  const { colors, dark } = useTheme();

  const mark = (state: SMTimelineStepState): { icon?: IconName; fg: string; bg: string; border: string } => {
    switch (state) {
      case 'done':
        return { icon: 'check', fg: colors.onPrimary ?? '#FFFFFF', bg: colors.success, border: colors.success };
      case 'failed':
        return { icon: 'close', fg: colors.onPrimary ?? '#FFFFFF', bg: colors.destructive, border: colors.destructive };
      case 'current':
        return { fg: colors.warning, bg: colors.warningLight, border: colors.warning };
      default:
        return { fg: colors.muted, bg: 'transparent', border: dark ? colors.borderStrong : colors.border };
    }
  };

  const spoken: Record<SMTimelineStepState, string> = {
    done: 'done',
    current: 'in progress',
    upcoming: 'not yet',
    failed: 'did not happen',
  };

  return (
    <View accessibilityRole="list">
      {steps.map((step, index) => {
        const look = mark(step.state);
        const last = index === steps.length - 1;
        const nextDone = steps[index + 1]?.state === 'done' || steps[index + 1]?.state === 'failed' || steps[index + 1]?.state === 'current';

        return (
          <View
            key={step.key}
            style={styles.row}
            accessible
            accessibilityLabel={step.label + ', ' + spoken[step.state] + (step.detail ? ', ' + step.detail : '')}
          >
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: look.bg, borderColor: look.border }]}>
                {look.icon ? (
                  <Icon name={look.icon} size={11} color={look.fg} />
                ) : step.state === 'current' ? (
                  <View style={[styles.core, { backgroundColor: colors.warning }]} />
                ) : null}
              </View>
              {!last ? (
                <View
                  style={[
                    styles.connector,
                    {
                      backgroundColor: nextDone && step.state === 'done'
                        ? colors.success
                        : dark
                          ? colors.borderStrong
                          : colors.border,
                    },
                  ]}
                />
              ) : null}
            </View>

            <View style={[styles.body, last ? null : styles.bodyGap]}>
              <Text
                style={[
                  styles.label,
                  {
                    color: step.state === 'upcoming' ? colors.muted : colors.text,
                    fontWeight: step.state === 'current' ? '800' : '600',
                  },
                ]}
              >
                {step.label}
              </Text>
              {step.detail ? (
                <Text style={[styles.detail, { color: step.state === 'failed' ? colors.destructive : colors.muted }]}>
                  {step.detail}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: 22 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: { width: 8, height: 8, borderRadius: 4 },
  connector: { width: 2, flex: 1, minHeight: 18, marginVertical: 2 },
  body: { flex: 1, paddingTop: 1 },
  bodyGap: { paddingBottom: spacing.base },
  label: { fontSize: typography.bodySm },
  detail: { fontSize: typography.caption, lineHeight: 18, marginTop: 1 },
});
