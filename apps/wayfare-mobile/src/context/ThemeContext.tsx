import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { wayfareDarkTheme, wayfareLightTheme } from '../theme';

export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'wayfare_theme_mode_v1';

type Ctx = {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => Promise<void>;
  paperTheme: typeof wayfareLightTheme;
  isDark: boolean;
};

const ThemeContext = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
    });
  }, []);

  const setMode = useCallback(async (m: ThemeMode) => {
    setModeState(m);
    await AsyncStorage.setItem(KEY, m);
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const paperTheme = isDark ? wayfareDarkTheme : wayfareLightTheme;

  const value = useMemo(() => ({ mode, setMode, paperTheme, isDark }), [mode, setMode, paperTheme, isDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useWayfareTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useWayfareTheme outside ThemeProvider');
  return ctx;
}
