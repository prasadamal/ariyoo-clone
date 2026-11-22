import { Platform } from 'react-native';

/** Looks for the diary page. Each person picks one; it's remembered on this phone. */
export type DiaryThemeId = 'diary' | 'note' | 'lavender' | 'night';

export type DiaryTheme = {
  id: DiaryThemeId;
  name: string;
  /** Page colour, ink colour, faint colour (dates, hints), rule-line colour (null: no lines). */
  paper: string;
  ink: string;
  faint: string;
  rule: string | null;
  /** A margin line down the left, like a school notebook. */
  margin: string | null;
  font: string | undefined;
  dark: boolean;
};

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' });

export const DIARY_THEMES: DiaryTheme[] = [
  { id: 'diary', name: 'Personal diary', paper: '#fbf6ea', ink: '#3b2f2a', faint: '#a1907f', rule: '#e8dcc6', margin: '#f2b8b0', font: serif, dark: false },
  { id: 'note', name: 'Simple note', paper: '#ffffff', ink: '#18181b', faint: '#a1a1aa', rule: null, margin: null, font: undefined, dark: false },
  { id: 'lavender', name: 'Lavender', paper: '#f6effb', ink: '#3f0263', faint: '#a688bd', rule: '#eadcf4', margin: null, font: serif, dark: false },
  { id: 'night', name: 'Night', paper: '#16121d', ink: '#ece6f5', faint: '#8a7f9c', rule: '#262033', margin: null, font: serif, dark: true },
];

export const DIARY_LINE_HEIGHT = 30;

export function diaryTheme(id: string | null | undefined): DiaryTheme {
  return DIARY_THEMES.find(t => t.id === id) ?? DIARY_THEMES[0];
}
