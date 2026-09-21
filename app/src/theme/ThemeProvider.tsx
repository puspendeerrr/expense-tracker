import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useColorScheme } from 'react-native';
import * as secureStore from '@/storage/secureStore';
import { palettes } from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';

/**
 * Stored through the same keystore wrapper as the session token.
 *
 * Not because a theme is a secret, but because it is the app's only persistence layer.
 * Pulling in a second storage library -- and a second native module to build, link and
 * keep in step -- to remember one word of preference is a poor trade.
 */
const MODE_KEY = 'splitwise.theme-mode';

const isMode = (value: unknown): value is ThemeMode =>
  value === 'system' || value === 'light' || value === 'dark';

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  dark: boolean;
  isDark: boolean;
  colors: typeof palettes.light;
  /** False until the stored choice has been read. Used to hold the splash a beat longer. */
  hydrated: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  // Starts on `system`, which is right for anyone who never changed it and is the
  // closest guess for everyone else, so the hydration below rarely changes anything
  // visible.
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [hydrated, setHydrated] = useState(false);
  const system = useColorScheme();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await secureStore.getItem(MODE_KEY);
      if (cancelled) return;
      if (isMode(stored)) setModeState(stored);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    // Applied immediately and written in the background: a tap on a theme button has to
    // feel instant, and a failed write costs the preference, not the interaction.
    setModeState(next);
    void secureStore.setItem(MODE_KEY, next);
  }, []);

  const dark = mode === 'system' ? system === 'dark' : mode === 'dark';

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, setMode, dark, isDark: dark, colors: palettes[dark ? 'dark' : 'light'], hydrated }),
    [mode, setMode, dark, hydrated],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme requires ThemeProvider');
  return theme;
}
