// Browser preview only: the real map is a native phone component. This stand-in shows a placeholder
// so every other screen can be viewed and edited in the browser. Phones use the real react-native-maps.
import React from 'react';
import { Text, View } from 'react-native';

const MapView = ({ style }) => (
  <View style={[{ alignItems: 'center', justifyContent: 'center', backgroundColor: '#e7e5e4', minHeight: 180 }, style]}>
    <Text style={{ color: '#57534e' }}>The map shows on the phone app</Text>
  </View>
);
const Nothing = () => null;

export default MapView;
export const Marker = Nothing;
export const Polyline = Nothing;
export const Circle = Nothing;
export const PROVIDER_GOOGLE = 'google';
