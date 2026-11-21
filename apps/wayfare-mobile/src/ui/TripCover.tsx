import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { Icon } from './Icon';

type Props = {
  /** The cover photo (a file on this phone), if the journey has one. */
  uri?: string | null;
  /** Fallback colours when there is no photo. */
  gradient: [string, string];
  /** Total spent so far, for example "₹15,000". */
  spent?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * The top of a journey card or page: the cover photo with a dark fade so white text stays readable,
 * or a colour gradient when there is no photo. The total spent is a small label in the corner.
 */
export function TripCover({ uri, gradient, spent, style, children }: Props) {
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      {uri ? (
        <>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessibilityElementsHidden />
          <LinearGradient colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.72)']} style={StyleSheet.absoluteFill} />
        </>
      ) : (
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      {children}
      {spent ? (
        <View
          accessibilityLabel={`${spent} spent`}
          style={{ position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}
        >
          <Icon name="wallet-outline" size={14} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{spent}</Text>
        </View>
      ) : null}
    </View>
  );
}
