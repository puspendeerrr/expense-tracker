import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The app's only icon.
 *
 * ONE FAMILY, ON PURPOSE. Feather is a single-weight outlined set drawn on a 24px grid
 * with a uniform 2px stroke, so icons sit together without one looking heavier than its
 * neighbour. Mixing filled and outlined sets, or an icon font with an emoji, is what makes
 * an interface look assembled rather than designed.
 *
 * It replaces the Unicode characters this app used to draw with — `‹`, `⋯`, `✦`, `⚙`.
 * Those are typography, not iconography: they render at the mercy of whatever font the
 * device falls back to, they carry no accessible name, and they cannot be sized or aligned
 * to a grid. Feather ships as a font with the Expo SDK, so this costs no native rebuild
 * and no SVG runtime.
 *
 * NAMES ARE SEMANTIC. Screens ask for `expense`, not `file-text`, so the day an expense
 * should look like something else it changes in one place rather than in fourteen.
 */

export type IconName = keyof typeof ICONS;

const ICONS = {
  /* Domain */
  expense: 'file-text',
  settlement: 'repeat',
  balance: 'trending-up',
  group: 'users',
  person: 'user',
  activity: 'clock',
  receipt: 'image',
  camera: 'camera',
  money: 'dollar-sign',

  /* Navigation and chrome */
  back: 'chevron-left',
  forward: 'chevron-right',
  close: 'x',
  more: 'more-horizontal',
  add: 'plus',
  filter: 'sliders',
  search: 'search',
  refresh: 'refresh-cw',

  /* Settings and account */
  settings: 'settings',
  notifications: 'bell',
  bell: 'bell',
  security: 'shield',
  shield: 'shield',
  devices: 'smartphone',
  smartphone: 'smartphone',
  appearance: 'sun',
  sun: 'sun',
  moon: 'moon',
  privacy: 'eye-off',
  eye: 'eye',
  eyeOff: 'eye-off',
  signOut: 'log-out',

  /* Domain & Elements */
  tag: 'tag',
  users: 'users',
  user: 'user',
  'pie-chart': 'pie-chart',
  'credit-card': 'credit-card',
  calendar: 'calendar',
  'file-text': 'file-text',
  'external-link': 'external-link',
  'alert-circle': 'alert-circle',
  'dollar-sign': 'dollar-sign',
  maximize: 'maximize-2',

  /* Feedback */
  check: 'check',
  clock: 'clock',
  alert: 'alert-circle',
  info: 'info',
  copy: 'copy',
  send: 'send',
  stop: 'square',
  trash: 'trash-2',
  edit: 'edit-2',

  /* The assistant */
  ai: 'zap',
} as const;

/**
 * Colour is semantic rather than free-form, so an icon cannot drift away from the theme.
 * `inherit` means "whatever the caller set on the surrounding text".
 */
export type IconTone =
  | 'default'
  | 'muted'
  | 'primary'
  | 'onPrimary'
  | 'inverse'
  | 'danger'
  | 'destructive'
  | 'success'
  | 'warning';

export function Icon({
  name,
  size = 20,
  tone = 'default',
  color,
  label,
}: {
  name: IconName;
  size?: number;
  tone?: IconTone;
  /** An explicit colour, for the rare case a tone cannot express. */
  color?: string;
  /**
   * Spoken name. Supply it when the icon is the ONLY thing conveying meaning; leave it
   * off when a visible label sits beside it, so a screen reader does not say it twice.
   */
  label?: string;
}) {
  const { colors } = useTheme();

  const tones: Record<IconTone, string> = {
    default: colors.text,
    muted: colors.muted,
    primary: colors.primary,
    onPrimary: colors.onPrimary,
    inverse: colors.onPrimary,
    danger: colors.destructive,
    destructive: colors.destructive,
    success: colors.success,
    warning: colors.warning,
  };

  return (
    <Feather
      name={ICONS[name]}
      size={size}
      color={color ?? tones[tone]}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
      {...(label ? { accessibilityLabel: label, accessibilityRole: 'image' as const } : {})}
    />
  );
}
