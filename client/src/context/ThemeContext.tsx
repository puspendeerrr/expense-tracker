import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Light / dark / system theme.
 *
 * "System" is a distinct stored value rather than a resolved one: someone who picks it
 * expects the app to keep following their OS after they change it, which only works if
 * the preference itself is remembered instead of the colour it happened to resolve to.
 *
 * The class goes on <html> so Radix portals -- dialogs, dropdowns, tooltips -- inherit
 * it. They render at document.body, outside any layout container, so scoping the class
 * to a wrapper would leave every popover stranded in the wrong theme.
 */

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'splitwise-theme';

interface ThemeContextValue {
  /** What the user chose. */
  preference: ThemePreference;
  /** What that currently resolves to. */
  resolved: 'light' | 'dark';
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const systemPrefersDark = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;

const readStored = (): ThemePreference => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // Private mode, blocked storage, or a thumbnail capture: fall through to the default.
  }
  // Light, not 'system'. SplitWise is a light product everywhere outside this console,
  // so following the OS would drop an operator into an all-dark console they never
  // asked for, next to a light user app. Dark is opt-in.
  return 'light';
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStored);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Follow the OS while the preference is "system".
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return;

    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const resolved: 'light' | 'dark' =
    preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not being able to remember the choice is not a reason to refuse to apply it.
    }
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
