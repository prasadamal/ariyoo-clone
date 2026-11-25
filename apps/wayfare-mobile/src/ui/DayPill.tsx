import { Image } from 'expo-image';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '../theme';

/**
 * Which day a run of moments belongs to ("Pre-trip · Fri 20 Nov", "Day 2 · Mon 23 Nov"), as a soft
 * lavender pill shaped like the moments pill on the trip cover: the Wayfare mark, then the words.
 */
export function DayPill({ label }: { label: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', marginTop: 8, marginBottom: 12 }} accessibilityRole="header" accessible accessibilityLabel={label}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.primaryContainer }}>
        <Image source={require('../../assets/logo-mark.png')} style={{ width: 22, height: 13 }} tintColor={colors.primary} contentFit="contain" />
        <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}
