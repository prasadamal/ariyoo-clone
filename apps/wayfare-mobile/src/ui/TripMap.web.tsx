import type { StyleProp, ViewStyle } from 'react-native';
import type { LatLng, MapPin } from '../lib/mapView';

// Browser preview only: MapLibre's map is a native phone view. Screens check `mapAvailable` and
// keep their drawn route / "Open in Maps" button here. Phones use TripMap.tsx.

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const mapAvailable = false;

type Props = { route?: LatLng[]; pins?: MapPin[]; style?: StyleProp<ViewStyle>; onFail?: () => void; interactive?: boolean };

export function TripMap(_props: Props) {
  return null;
}
