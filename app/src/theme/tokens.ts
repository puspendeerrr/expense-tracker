export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  hero: 40,
};

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const typography = {
  xs: 11,
  caption: 13,
  bodySm: 14,
  body: 16,
  titleSm: 18,
  title: 22,
  heroSm: 26,
  hero: 32,
  display: 40,
};

export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const lineHeights = {
  xs: 15,
  caption: 18,
  bodySm: 20,
  body: 24,
  titleSm: 24,
  title: 28,
  heroSm: 32,
  hero: 38,
  display: 48,
};

export const shadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
};

export const motion = {
  duration: {
    fast: 150,
    normal: 220,
    emphasis: 300,
  },
  scale: {
    pressed: 0.97,
    active: 0.95,
  },
};

export const palettes = {
  light: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    subtle: '#ECFDF5',
    border: '#E2E8F0',
    borderStrong: '#CBD5E1',
    text: '#0F172A',
    muted: '#64748B',
    mutedSubtle: '#94A3B8',
    primary: '#059669', // SplitMoney Emerald Green HSL 160 84% 36%
    primaryLight: '#10B981',
    primarySubtle: '#ECFDF5',
    onPrimary: '#FFFFFF',
    destructive: '#EF4444',
    destructiveLight: '#FEE2E2',
    destructiveSubtle: '#FEE2E2',
    success: '#10B981',
    successLight: '#D1FAE5',
    successSubtle: '#D1FAE5',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    warningSubtle: '#FEF3C7',
    info: '#3B82F6',
    infoLight: '#DBEAFE',
    infoSubtle: '#DBEAFE',
  },
  dark: {
    background: '#09090B',
    surface: '#141417',
    surfaceElevated: '#1C1C21',
    subtle: '#064E3B2E',
    border: '#27272A',
    borderStrong: '#3F3F46',
    text: '#F8FAFC',
    muted: '#A1A1AA',
    mutedSubtle: '#71717A',
    primary: '#10B981', // Vivid emerald for dark mode
    primaryLight: '#34D399',
    primarySubtle: '#064E3B44',
    onPrimary: '#FFFFFF',
    destructive: '#F87171',
    destructiveLight: '#450A0A66',
    destructiveSubtle: '#450A0A66',
    success: '#34D399',
    successLight: '#064E3B55',
    successSubtle: '#064E3B55',
    warning: '#FBBF24',
    warningLight: '#451A0366',
    warningSubtle: '#451A0366',
    info: '#60A5FA',
    infoLight: '#17255466',
    infoSubtle: '#17255466',
  },
};
