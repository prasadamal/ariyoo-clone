import { Image } from 'expo-image';
import { useState } from 'react';
import { Dimensions, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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

export function PhotoViewer({ uris, index, onClose }: { uris: string[]; index: number | null; onClose: () => void }) {
  return (
    <Modal visible={index != null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <FlatList
          data={uris}
          horizontal
          pagingEnabled
          initialScrollIndex={index ?? 0}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
          keyExtractor={(u, i) => u + i}
          renderItem={({ item }) => (
            <Image source={{ uri: item }} style={{ width: SCREEN_W, height: SCREEN_H }} contentFit="contain" />
          )}
        />
        <IconButton icon="close" iconColor="#fff" size={28} style={{ position: 'absolute', top: 40, right: 12 }} onPress={onClose} accessibilityLabel="Close photo" />
      </View>
    </Modal>
  );
}
