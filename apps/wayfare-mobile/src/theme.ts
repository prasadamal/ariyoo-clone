import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export const wayfareLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#c2410c',
    secondary: '#0f766e',
    background: '#fafaf9',
    surface: '#ffffff',
    surfaceVariant: '#f5f5f4',
  },
};

export const wayfareDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#fb923c',
    secondary: '#2dd4bf',
    background: '#0c0a09',
    surface: '#1c1917',
    surfaceVariant: '#292524',
  },
};
