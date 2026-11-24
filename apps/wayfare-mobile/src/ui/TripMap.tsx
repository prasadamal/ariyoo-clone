import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { cameraFor, pinPoints, routeLine, type LatLng, type MapPin } from '../lib/mapView';
import { useAppTheme } from '../theme';

/**
 * Free OpenStreetMap tiles from OpenFreeMap: no account, no key, no usage limits. Places you have
 * looked at stay cached on the phone, so a map you opened before still shows without signal.
 * The map's ⓘ button shows the OpenStreetMap credit the tiles require.
 */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/** Phones draw real maps; the browser preview keeps the drawn route instead (TripMap.web.tsx). */
export const mapAvailable = true;

type Props = {
  /** A recorded route, drawn as a line. */
  route?: LatLng[];
  /** Points to mark: start, latest, moments, a person. */
  pins?: MapPin[];
  style?: StyleProp<ViewStyle>;
  /** Called when the map can't load (offline before it was ever opened); show something else. */
  onFail?: () => void;
  /** Pinch and drag (on by default). */
  interactive?: boolean;
};

/** A MapLibre map with the journey's route and pins, framed to fit them. */
export function TripMap({ route = [], pins = [], style, onFail, interactive = true }: Props) {
  const { colors } = useAppTheme();
  const line = useMemo(() => routeLine(route), [route]);
  const points = useMemo(() => pinPoints(pins), [pins]);
  const camera = useMemo(() => cameraFor([...route, ...pins]), [route, pins]);
  if (!camera) return null;
  const padding = { top: 36, bottom: 36, left: 36, right: 36 };

  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <Map
        style={{ flex: 1 }}
        mapStyle={MAP_STYLE_URL}
        logo={false}
        attribution
        attributionPosition={{ bottom: 6, right: 6 }}
        compass={false}
        touchPitch={false}
        touchRotate={false}
        dragPan={interactive}
        touchZoom={interactive}
        doubleTapZoom={interactive}
        onDidFailLoadingMap={onFail ? () => onFail() : undefined}
      >
        <Camera initialViewState={'bounds' in camera ? { bounds: camera.bounds, padding } : { center: camera.center, zoom: camera.zoom }} maxZoom={17} />
        {line ? (
          <GeoJSONSource id="wayfare-route" data={line}>
            <Layer id="wayfare-route-casing" type="line" layout={{ 'line-join': 'round', 'line-cap': 'round' }} paint={{ 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.9 }} />
            <Layer id="wayfare-route-line" type="line" layout={{ 'line-join': 'round', 'line-cap': 'round' }} paint={{ 'line-color': colors.primary, 'line-width': 4.5 }} />
          </GeoJSONSource>
        ) : null}
        {points.features.length ? (
          <GeoJSONSource id="wayfare-pins" data={points}>
            <Layer
              id="wayfare-pins-dots"
              type="circle"
              paint={{
                'circle-radius': ['get', 'r'],
                'circle-color': ['match', ['get', 'kind'], 'start', '#16a34a', 'end', colors.secondary, 'person', colors.primary, '#7c3aed'],
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2.5,
              }}
            />
          </GeoJSONSource>
        ) : null}
      </Map>
    </View>
  );
}
