import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Text } from 'react-native-paper';
import { deleteEntryMedia, listEntryMedia, type LocalEntryMedia } from '../lib/localDb';
import { isAudio, resolveMediaUri } from '../lib/media';
import { useAppTheme } from '../theme';
import { Icon } from '../ui/Icon';
import { PhotoViewer } from '../ui/PhotoGrid';
import { Glass } from '../ui/Glass';

/**
 * A moment's photos in one fixed 4:3 window. With several photos the window looks like a small stack
 * (two cards peek out behind it) with a "1/3" counter, and you swipe sideways through them. Tap to view
 * full screen; long-press to remove. Renders nothing when there are no photos.
 */
export function MomentPhotos({ entryId, refreshKey = 0, onChanged, canEdit = true, inset = 12 }: { entryId: string; refreshKey?: number; onChanged?: () => void; canEdit?: boolean; /** Space at the sides (0: as wide as the moment). */ inset?: number }) {
  const { colors } = useAppTheme();
  const [items, setItems] = useState<{ media: LocalEntryMedia; uri: string }[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);

  const load = useCallback(async () => {
    const all = (await listEntryMedia(entryId)).filter(m => !isAudio(m.mime_type));
    const resolved: { media: LocalEntryMedia; uri: string }[] = [];
    for (const media of all) {
      const uri = await resolveMediaUri(media);
      if (uri) resolved.push({ media, uri });
    }
    setItems(resolved);
    setPage(p => Math.min(p, Math.max(0, resolved.length - 1)));
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

  const many = items.length > 1;
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width) setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={{ paddingHorizontal: inset, paddingTop: many ? 12 : 4 }}>
      {many ? (
        <>
          {/* The stack: two cards peeking out behind the photo say "there are more". */}
          <View style={{ position: 'absolute', top: 0, left: 28, right: 28, height: 24, borderRadius: 14, backgroundColor: colors.surfaceVariant, opacity: 0.6 }} />
          <View style={{ position: 'absolute', top: 6, left: 20, right: 20, height: 24, borderRadius: 14, backgroundColor: colors.surfaceVariant }} />
        </>
      ) : null}
      <View onLayout={onLayout} style={{ borderRadius: 14, overflow: 'hidden', aspectRatio: 4 / 3, backgroundColor: colors.surfaceVariant }}>
        {width ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={32} scrollEnabled={many}>
            {items.map((item, i) => (
              <Pressable
                key={item.media.id}
                onPress={() => setOpen(i)}
                onLongPress={canEdit ? () => remove(item.media) : undefined}
                accessibilityLabel={`Photo ${i + 1} of ${items.length}. Tap to enlarge${canEdit ? ', long press to remove' : ''}.`}
              >
                <Image source={{ uri: item.uri }} style={{ width, aspectRatio: 4 / 3 }} contentFit="cover" transition={150} />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        {many ? (
          <Glass
            variant="media"
            radius={999}
            pointerEvents="none"
            style={{ position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4 }}
          >
            <Icon name="image-multiple-outline" size={13} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
              {page + 1}/{items.length}
            </Text>
          </Glass>
        ) : null}
      </View>
      <PhotoViewer uris={items.map(i => i.uri)} index={open} onClose={() => setOpen(null)} />
    </View>
  );
}
