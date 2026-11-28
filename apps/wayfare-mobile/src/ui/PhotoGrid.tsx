import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { IconButton, Text } from 'react-native-paper';
import { ZoomableImage } from './ZoomableImage';

type Props = { uris: string[]; height?: number; radius?: number };

/** 1–4 tile layout (with "+N"), tap to open a swipeable full-screen viewer. */
export function PhotoGrid({ uris, height = 220, radius = 14 }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  if (!uris.length) return null;
  const shown = uris.slice(0, 4);
  const extra = uris.length - shown.length;
  const tile = (uri: string, i: number, style: object) => (
    <Pressable key={uri + i} style={[{ overflow: 'hidden' }, style]} onPress={() => setOpen(i)} accessibilityLabel={`Photo ${i + 1} of ${uris.length}`}>
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={120} />
      {i === 3 && extra > 0 ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>+{extra}</Text>
        </View>
      ) : null}
    </Pressable>
  );
  let body;
  if (shown.length === 1) body = tile(shown[0], 0, { flex: 1 });
  else if (shown.length === 2) body = <View style={{ flex: 1, flexDirection: 'row', gap: 3 }}>{shown.map((u, i) => tile(u, i, { flex: 1 }))}</View>;
  else
    body = (
      <View style={{ flex: 1, flexDirection: 'row', gap: 3 }}>
        {tile(shown[0], 0, { flex: 2 })}
        <View style={{ flex: 1, gap: 3 }}>{shown.slice(1).map((u, i) => tile(u, i + 1, { flex: 1 }))}</View>
      </View>
    );
  return (
    <>
      <View style={{ height, borderRadius: radius, overflow: 'hidden' }}>{body}</View>
      <PhotoViewer uris={uris} index={open} onClose={() => setOpen(null)} />
    </>
  );
}

/**
 * Full-screen photos: swipe sideways between them, double-tap or pinch to zoom (paging pauses while
 * a photo is zoomed), tap once to hide or show the buttons.
 */
export function PhotoViewer({ uris, index, onClose }: { uris: string[]; index: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const [zoomed, setZoomed] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [at, setAt] = useState(index ?? 0);
  const onZoomChange = useCallback((z: boolean) => setZoomed(z), []);
  const toggleChrome = useCallback(() => setChrome(c => !c), []);
  return (
    <Modal visible={index != null} transparent animationType="fade" onRequestClose={onClose} onShow={() => { setAt(index ?? 0); setZoomed(false); setChrome(true); }}>
      {/* Gestures inside a Modal need their own root on Android. */}
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
        <FlatList
          data={uris}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          initialScrollIndex={index ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={e => setAt(Math.round(e.nativeEvent.contentOffset.x / width))}
          keyExtractor={(u, i) => u + i}
          extraData={zoomed}
          renderItem={({ item }) => <ZoomableImage uri={item} width={width} height={height} zoomed={zoomed} onZoomChange={onZoomChange} onTap={toggleChrome} />}
        />
        {chrome ? (
          <View style={{ position: 'absolute', top: 40, left: 8, right: 8, flexDirection: 'row', alignItems: 'center' }} pointerEvents="box-none">
            {uris.length > 1 ? <Text style={{ color: '#fff', marginLeft: 12, fontWeight: '600' }}>{`${Math.min(at, uris.length - 1) + 1} / ${uris.length}`}</Text> : null}
            <View style={{ flex: 1 }} />
            <IconButton icon="close" iconColor="#fff" size={28} onPress={onClose} accessibilityLabel="Close photo" />
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}
