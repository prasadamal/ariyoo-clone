import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { ColorValue, StyleProp, TextStyle } from 'react-native';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Accepts icon names from data (strings) without casting at every call site. */
export function Icon({
  name,
  size = 20,
  color,
  style,
}: {
  name: string;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<TextStyle>;
}) {
  return <MaterialCommunityIcons name={name as IconName} size={size} color={color} style={style} />;
}
