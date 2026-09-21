import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { palettes } from '@/theme/tokens';

/**
 * Android notification channels.
 *
 * A channel is the unit Android gives the *user* control over: once created, they can
 * mute, un-mute or change the importance of each one from system settings, and the app
 * cannot override them. Which is the point — somebody who wants security alerts but not
 * every expense their flatmate adds can have exactly that, without us building a second
 * preferences system to approximate it.
 *
 * Android only lets an app change a channel's NAME and DESCRIPTION after creation.
 * Importance is fixed at creation and thereafter belongs to the user. So the importance
 * chosen here is a one-time decision, not a setting to tune later.
 *
 * Only `security` is HIGH. High importance on Android means heads-up: it interrupts
 * whatever the person is doing. "Somebody signed into your account" earns that. "Rahul
 * added Dinner" does not, and an app that treats every event as urgent is an app whose
 * notifications get switched off wholesale.
 */

export const CHANNELS = {
  financial: 'financial',
  settlements: 'settlements',
  activity: 'activity',
  security: 'security',
  general: 'general',
} as const;

export type ChannelId = (typeof CHANNELS)[keyof typeof CHANNELS];

type ChannelSpec = {
  id: ChannelId;
  name: string;
  description: string;
  importance: Notifications.AndroidImportance;
  /** Whether the content may appear on a locked screen. */
  privacy: Notifications.AndroidNotificationVisibility;
};

const SPECS: ChannelSpec[] = [
  {
    id: CHANNELS.security,
    name: 'Security',
    description: 'New sign-ins, password changes and session activity on your account.',
    importance: Notifications.AndroidImportance.HIGH,
    // Shown in full when locked: a security alert you cannot read until you unlock is
    // an alert that arrives too late to be worth sending.
    privacy: Notifications.AndroidNotificationVisibility.PUBLIC,
  },
  {
    id: CHANNELS.settlements,
    name: 'Settlements',
    description: 'Payment requests, confirmations, rejections and reminders.',
    importance: Notifications.AndroidImportance.DEFAULT,
    /*
     * PRIVATE hides the content on a locked screen and shows only that SplitWise has
     * something for you. Money is the one thing on this app worth keeping off a screen
     * that anybody nearby can read.
     */
    privacy: Notifications.AndroidNotificationVisibility.PRIVATE,
  },
  {
    id: CHANNELS.financial,
    name: 'Expenses',
    description: 'Expenses added, edited or deleted in your groups.',
    importance: Notifications.AndroidImportance.DEFAULT,
    privacy: Notifications.AndroidNotificationVisibility.PRIVATE,
  },
  {
    id: CHANNELS.activity,
    name: 'Group activity',
    description: 'People joining or leaving your groups, and other group changes.',
    importance: Notifications.AndroidImportance.LOW,
    privacy: Notifications.AndroidNotificationVisibility.PRIVATE,
  },
  {
    id: CHANNELS.general,
    name: 'General',
    description: 'Anything that does not fit the other categories.',
    importance: Notifications.AndroidImportance.LOW,
    privacy: Notifications.AndroidNotificationVisibility.PRIVATE,
  },
];

/**
 * Creates every channel. Safe to call on each launch — Android treats a repeat as an
 * update of the name and description and leaves the user's own choices alone.
 */
export const registerChannels = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;

  const accent = palettes.light.primary;

  await Promise.all(
    SPECS.map((spec) =>
      Notifications.setNotificationChannelAsync(spec.id, {
        name: spec.name,
        description: spec.description,
        importance: spec.importance,
        lockscreenVisibility: spec.privacy,
        // The small icon is monochrome by Android's rules; this tints it and the LED.
        lightColor: accent,
        vibrationPattern: spec.importance === Notifications.AndroidImportance.HIGH
          ? [0, 250, 250, 250]
          : [0, 150],
        showBadge: true,
      }),
    ),
  );
};
