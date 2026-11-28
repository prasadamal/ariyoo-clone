import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { listTripMedia } from '../../lib/localDb';
import { isAudio, resolveMediaUri } from '../../lib/media';
import { useAppTheme } from '../../theme';
import { PhotoViewer } from '../../ui/PhotoGrid';

/** Every photo of a journey in a three-column grid; tap one to see it large (swipe, double-tap to zoom). */
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
      <PhotoViewer uris={uris} index={open} onClose={() => setOpen(null)} />
    </View>
  );
}
