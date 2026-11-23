import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, IconButton, Text } from 'react-native-paper';
import { listTripMedia } from '../../lib/localDb';
import { isAudio, resolveMediaUri } from '../../lib/media';
import { useAppTheme } from '../../theme';

/** Every photo of a journey in a three-column grid; tap one to see it large. */
export function PhotoGrid({ tripId, refreshKey }: { tripId: string; refreshKey?: number }) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [uris, setUris] = useState<string[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const size = Math.floor((Math.min(width, 520) - 32 - 8) / 3);

  useEffect(() => {
    let active = true;
    (async () => {
      const media = (await listTripMedia(tripId)).filter(m => !isAudio(m.mime_type)).reverse();
      const resolved = await Promise.all(media.map(m => resolveMediaUri(m).catch(() => null)));
      if (active) setUris(resolved.filter((u): u is string => Boolean(u)));
    })().catch(() => active && setUris([]));
    return () => {
      active = false;
    };
  }, [tripId, refreshKey]);

  if (uris == null) return <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary} />;
  if (!uris.length) return <Text style={{ color: colors.muted, textAlign: 'center', marginVertical: 24 }}>No photos in this journey yet.</Text>;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {uris.map((uri, i) => (
        <Pressable key={uri + i} onPress={() => setOpen(i)} accessibilityRole="imagebutton" accessibilityLabel={`Photo ${i + 1} of ${uris.length}`}>
          <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 10, backgroundColor: colors.surfaceVariant }} contentFit="cover" transition={120} />
        </Pressable>
      ))}
      <Modal visible={open != null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, backgroundColor: '#000000f0', justifyContent: 'center' }}>
          {open != null ? <Image source={{ uri: uris[open] }} style={{ width: '100%', height: '80%' }} contentFit="contain" /> : null}
          <View style={{ position: 'absolute', top: 40, left: 8, right: 8, flexDirection: 'row', alignItems: 'center' }}>
            <IconButton icon="close" iconColor="#fff" onPress={() => setOpen(null)} accessibilityLabel="Close photo" />
            <View style={{ flex: 1 }} />
            <IconButton icon="chevron-left" iconColor="#fff" disabled={!open} onPress={() => setOpen(o => (o ? o - 1 : o))} accessibilityLabel="Previous photo" />
            <Text style={{ color: '#fff' }}>{open != null ? `${open + 1} / ${uris.length}` : ''}</Text>
            <IconButton icon="chevron-right" iconColor="#fff" disabled={open == null || open >= uris.length - 1} onPress={() => setOpen(o => (o != null && o < uris.length - 1 ? o + 1 : o))} accessibilityLabel="Next photo" />
          </View>
        </View>
      </Modal>
    </View>
  );
}
