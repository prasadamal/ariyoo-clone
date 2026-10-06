import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { deleteEntryMedia, listEntryMedia, type LocalEntryMedia } from '../lib/localDb';
import { isAudio, resolveMediaUri } from '../lib/media';
import { PhotoViewer } from '../ui/PhotoGrid';

/** Thumbnails for an entry's photos (local file or signed cloud URL). Long-press to remove. */
export function EntryMediaStrip({ entryId, refreshKey = 0, onChanged }: { entryId: string; refreshKey?: number; onChanged?: () => void }) {
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
    Alert.alert('Remove photo?', 'It will be removed from this entry on all your devices.', [
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

  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {items.map((item, i) => (
          <Pressable
            key={item.media.id}
            onPress={() => setOpen(i)}
            onLongPress={() => remove(item.media)}
            accessibilityLabel={`Photo ${i + 1}. Long press to remove.`}
          >
            <Image source={{ uri: item.uri }} style={{ width: 84, height: 84, borderRadius: 10 }} contentFit="cover" transition={120} />
          </Pressable>
        ))}
      </View>
      <PhotoViewer uris={items.map(i => i.uri)} index={open} onClose={() => setOpen(null)} />
    </>
  );
}
