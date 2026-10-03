import { View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

/** Small inline status/error message with theme-aware colours. */
export function StatusBanner({ kind, children }: { kind: 'error' | 'info' | 'success'; children: React.ReactNode }) {
  const theme = useTheme();
  const bg = kind === 'error' ? theme.colors.errorContainer : kind === 'success' ? theme.colors.secondaryContainer : theme.colors.surfaceVariant;
  const fg = kind === 'error' ? theme.colors.onErrorContainer : kind === 'success' ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant;
  return (
    <View accessibilityRole={kind === 'error' ? 'alert' : undefined} style={{ backgroundColor: bg, borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <Text style={{ color: fg }}>{children}</Text>
    </View>
  );
}
