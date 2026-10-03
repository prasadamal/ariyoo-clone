import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, View } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useSync } from '../context/SyncContext';
import { deleteEntryMedia, listEntryMedia, type LocalEntryMedia } from '../lib/localDb';
import { deleteLocalFile, getSignedMediaUrl } from '../lib/media';

/** Photo thumbnails for an entry. Tap to view full-screen, long-press to delete. */
export function EntryMediaStrip({ entryId }: { entryId: string }) {
  const { dataVersion, notifyLocalChange } = useSync();
  const [items, setItems] = useState<LocalEntryMedia[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<string | null>(null);

  useEffect(() => {
    listEntryMedia(entryId).then(all => setItems(all.filter(m => m.kind !== 'audio')));
  }, [entryId, dataVersion]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const item of items) {
        if (item.local_uri) next[item.id] = item.local_uri;
        else if (item.storage_path) {
          const signed = await getSignedMediaUrl(item.storage_path);
          if (signed) next[item.id] = signed;
        }
      }
      if (!cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const remove = useCallback(
    (item: LocalEntryMedia) => {
      Alert.alert('Delete photo', 'Remove this photo from the entry?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            deleteLocalFile(await deleteEntryMedia(item.id));
            notifyLocalChange();
          },
        },
      ]);
    },
    [notifyLocalChange]
  );

  if (!items.length) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {items.map(item =>
        urls[item.id] ? (
          <Pressable
            key={item.id}
            onPress={() => setViewing(urls[item.id])}
            onLongPress={() => remove(item)}
            accessibilityRole="imagebutton"
            accessibilityLabel="Journal photo. Double tap to enlarge, long press to delete."
          >
            <Image source={{ uri: urls[item.id] }} style={{ width: 84, height: 84, borderRadius: 8 }} />
          </Pressable>
        ) : null
      )}
      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable style={{ flex: 1, backgroundColor: '#000d', justifyContent: 'center' }} onPress={() => setViewing(null)}>
          {viewing ? <Image source={{ uri: viewing }} style={{ width: '100%', height: '80%' }} resizeMode="contain" /> : null}
          <IconButton icon="close" iconColor="#fff" style={{ position: 'absolute', top: 40, right: 12 }} onPress={() => setViewing(null)} accessibilityLabel="Close photo" />
        </Pressable>
      </Modal>
    </View>
  );
}
