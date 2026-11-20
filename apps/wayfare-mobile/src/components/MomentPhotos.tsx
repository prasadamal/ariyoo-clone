import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { deleteEntryMedia, listEntryMedia, type LocalEntryMedia } from '../lib/localDb';
import { isAudio, resolveMediaUri } from '../lib/media';
import { PhotoViewer } from '../ui/PhotoGrid';

/**
 * A moment's photos: the first one fills the width of the card, any others sit below as small
 * thumbnails. Tap to view full screen; long-press to remove. Renders nothing when there are no photos.
 */
export function MomentPhotos({ entryId, refreshKey = 0, onChanged }: { entryId: string; refreshKey?: number; onChanged?: () => void }) {
  const [items, setItems] = useState<{ media: LocalEntryMedia; uri: string }[]>([]);
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(async () => {
    const all = (await listEntryMedia(entryId)).filter(m => !isAudio(m.mime_type));
    const resolved: { media: LocalEntryMedia; uri: string }[] = [];
    for (const media of all) {
      const uri = await resolveMediaUri(media);
      if (uri) resolved.push({ media, uri });
    }
    setItems(resolved);
  }, [entryId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (!items.length) return null;

  const remove = (m: LocalEntryMedia) =>
    Alert.alert('Remove photo?', 'It will be removed from this moment on all your devices.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteEntryMedia(m.id);
          await load();
          onChanged?.();
        },
      },
    ]);

  const [first, ...rest] = items;
  return (
    <>
      <Pressable onPress={() => setOpen(0)} onLongPress={() => remove(first.media)} accessibilityLabel="Photo. Tap to enlarge, long press to remove.">
        <Image source={{ uri: first.uri }} style={{ width: '100%', aspectRatio: 4 / 3 }} contentFit="cover" transition={150} />
      </Pressable>
      {rest.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, padding: 8 }}>
          {rest.map((item, i) => (
            <Pressable key={item.media.id} onPress={() => setOpen(i + 1)} onLongPress={() => remove(item.media)} accessibilityLabel={`Photo ${i + 2}`}>
              <Image source={{ uri: item.uri }} style={{ width: 64, height: 64, borderRadius: 10 }} contentFit="cover" transition={120} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <PhotoViewer uris={items.map(i => i.uri)} index={open} onClose={() => setOpen(null)} />
    </>
  );
}
