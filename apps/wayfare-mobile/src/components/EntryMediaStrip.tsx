import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { listEntryMedia, type LocalEntryMedia } from '../lib/localDb';
import { getSignedPhotoUrl } from '../lib/media';

export function EntryMediaStrip({ entryId }: { entryId: string }) {
  const [items, setItems] = useState<LocalEntryMedia[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    listEntryMedia(entryId).then(all =>
      setItems(all.filter(m => !(m.mime_type ?? '').startsWith('audio')))
    );
  }, [entryId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const item of items) {
        if (item.local_uri) {
          next[item.id] = item.local_uri;
        } else if (item.storage_path) {
          const signed = await getSignedPhotoUrl(item.storage_path);
          if (signed) next[item.id] = signed;
        }
      }
      if (!cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  if (!items.length) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {items.map(item =>
        urls[item.id] ? (
          <Image
            key={item.id}
            source={{ uri: urls[item.id] }}
            style={{ width: 72, height: 72, borderRadius: 8 }}
          />
        ) : null
      )}
    </View>
  );
}
