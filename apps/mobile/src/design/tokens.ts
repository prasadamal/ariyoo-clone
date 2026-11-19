import { useColorScheme } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

/**
 * Ariyoo's visual language: "a trusted local friend". Warm paper and deep ink, a Kerala-green
 * accent for action and trust, and saffron reserved for experts. Every colour on screen comes from
 * here, so light and dark mode stay in step and contrast stays at WCAG AA or better.
 */
export type Palette = {
  bg: string; surface: string; surfaceAlt: string; border: string;
  text: string; textMuted: string; textFaint: string;
  accent: string; accentPressed: string; onAccent: string; accentSoft: string; onAccentSoft: string;
  expert: string; onExpert: string; expertSoft: string; onExpertSoft: string;
  danger: string; dangerSoft: string; success: string;
  bubbleMine: string; onBubbleMine: string; bubbleTheirs: string;
};

const light: Palette = {
  bg: '#F7F4EE', surface: '#FFFFFF', surfaceAlt: '#F0EBE2', border: '#E4DDD1',
  text: '#17212B', textMuted: '#58636E', textFaint: '#6B757E',
  accent: '#0E7A5F', accentPressed: '#0B634D', onAccent: '#FFFFFF', accentSoft: '#DDF1EA', onAccentSoft: '#0B5743',
  expert: '#9A5A06', onExpert: '#FFFFFF', expertSoft: '#FCEFD9', onExpertSoft: '#6E4205',
  danger: '#B9352B', dangerSoft: '#FBE6E3', success: '#1C7C45',
  bubbleMine: '#0E7A5F', onBubbleMine: '#FFFFFF', bubbleTheirs: '#FFFFFF',
};

const dark: Palette = {
  bg: '#0F1513', surface: '#171F1C', surfaceAlt: '#1F2925', border: '#2A3631',
  text: '#EEF2EF', textMuted: '#A9B6B0', textFaint: '#7D8B85',
  accent: '#3CC59B', accentPressed: '#2FA883', onAccent: '#04261C', accentSoft: '#163B30', onAccentSoft: '#9BE6CD',
  expert: '#F2B24E', onExpert: '#2A1B04', expertSoft: '#3A2B12', onExpertSoft: '#F7CF8F',
  danger: '#F07A6E', dangerSoft: '#3A1A16', success: '#5BD18F',
  bubbleMine: '#1F6E57', onBubbleMine: '#F2FBF7', bubbleTheirs: '#1F2925',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const type = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800' as const, letterSpacing: -0.8 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800' as const, letterSpacing: -0.5 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: '600' as const },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.6 },
};

export type Tokens = { c: Palette; dark: boolean };

/** The palette for the phone's current light or dark setting. */
export function useTokens(): Tokens {
  const dark = useColorScheme() === 'dark';
  return { c: dark ? darkPalette : lightPalette, dark };
}
export const lightPalette = light;
export const darkPalette = dark;

/** react-native-paper themes built from the same palette, so its inputs, dialogs and menus match. */
export function paperTheme(isDark: boolean): MD3Theme {
  const c = isDark ? dark : light;
  const base = isDark ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    roundness: 4,
    colors: {
      ...base.colors,
      primary: c.accent, onPrimary: c.onAccent,
      primaryContainer: c.accentSoft, onPrimaryContainer: c.onAccentSoft,
      secondary: c.expert, secondaryContainer: c.expertSoft, onSecondaryContainer: c.onExpertSoft,
      background: c.bg, surface: c.surface, onSurface: c.text, onBackground: c.text,
      surfaceVariant: c.surfaceAlt, onSurfaceVariant: c.textMuted,
      outline: c.border, outlineVariant: c.border,
      error: c.danger, errorContainer: c.dangerSoft,
      elevation: { ...base.colors.elevation, level0: 'transparent', level1: c.surface, level2: c.surface, level3: c.surface, level4: c.surface, level5: c.surface },
      surfaceDisabled: isDark ? 'rgba(238,242,239,0.10)' : 'rgba(23,33,43,0.08)',
      onSurfaceDisabled: isDark ? 'rgba(238,242,239,0.45)' : 'rgba(23,33,43,0.42)',
      backdrop: 'rgba(10,14,12,0.55)',
    },
  };
}
