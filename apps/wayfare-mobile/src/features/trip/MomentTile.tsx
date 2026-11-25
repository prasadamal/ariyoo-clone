import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { EntryVoiceNotes } from '../../components/EntryVoiceNotes';
import { deleteEntryMedia, listEntryMedia, type LocalEntry, type LocalEntryMedia } from '../../lib/localDb';
import { isAudio, resolveMediaUri } from '../../lib/media';
import { splitMentions } from '../../lib/mentions';
import { foldsMoment, isShortMoment, moodTint, shortWeather } from '../../lib/momentStyle';
import { formatMoney } from '../../lib/momentMoney';
import { stripRich } from '../../lib/richText';
import { useAppTheme } from '../../theme';
import { Icon } from '../../ui/Icon';
import { PhotoViewer } from '../../ui/PhotoGrid';
import { Sheet, SheetActions, type SheetAction } from '../../ui/Sheet';

type Props = {
  entry: LocalEntry;
  /** Total spent at this moment, if any. */
  money?: number;
  currencySymbol: string;
  mediaKey: number;
  canShare: boolean;
  /** Owner or admin of the journey: may edit and delete any moment. */
  canEdit?: boolean;
  /** Who wrote it, when it was someone else in a shared journey ("@anna"). */
  author?: string;
  tripId: string;
  onChanged: () => void;
  onAddPhotos: () => void;
  onDelete: () => void;
};

const PLACEHOLDER_BODIES = new Set(['📷', '🎙 Voice note', '💰']);
const FOLD_LINES = 4;
const PHOTO_RADIUS = 16;
const GAP = 2;

/**
 * One moment as a tile: a soft card with the time and mood on top, the photos across the full width
 * of the tile with rounded corners (one 4:3, two side by side, three or more as a mosaic with "+N"),
 * then the words, voice notes, and where / weather / money. Short words without photos are set big.
 * Tap a photo to see it full screen; tap long words to open or fold them; ⋯ or a long-press opens
 * Edit / Add photos / Remove photo / Delete. The date lives in the day heading above.
 */
export function MomentTile({ entry: e, money, currencySymbol, mediaKey, canShare, canEdit = true, author, tripId, onChanged, onAddPhotos, onDelete }: Props) {
  const { colors, dark } = useAppTheme();
  const [photos, setPhotos] = useState<{ media: LocalEntryMedia; uri: string }[]>([]);
  const [hasVoice, setHasVoice] = useState(false);
  const [width, setWidth] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  // The photo you long-pressed (its own "Remove this photo"); null when ⋯ opened the menu.
  const [menuPhoto, setMenuPhoto] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    const media = await listEntryMedia(e.id);
    setHasVoice(media.some(m => isAudio(m.mime_type)));
    const resolved: { media: LocalEntryMedia; uri: string }[] = [];
    for (const m of media.filter(x => !isAudio(x.mime_type))) {
      const uri = await resolveMediaUri(m);
      if (uri) resolved.push({ media: m, uri });
    }
    setPhotos(resolved);
  }, [e.id]);

  useEffect(() => {
    load();
  }, [load, mediaKey]);

  const at = new Date(e.recorded_at);
  const time = at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  const body = e.body && !PLACEHOLDER_BODIES.has(e.body) ? stripRich(e.body).trim() : '';
  const folds = foldsMoment(body);
  const emoji = e.mood ? e.mood.split(' ')[0] : null;
  const moodWord = e.mood ? e.mood.split(' ').slice(1).join(' ') : '';
  const moodColors = moodTint(e.mood, dark);
  const wx = shortWeather(e.weather);
  const hasLocation = Boolean(e.place_name) || (e.latitude != null && e.longitude != null);
  const big = !photos.length && isShortMoment(body);
  const a11yWhen = `${author ? `${author}, ` : ''}${time}${moodWord ? `, mood ${moodWord}` : ''}`;

  const removePhoto = (m: LocalEntryMedia) =>
    Alert.alert('Remove this photo?', 'It will be removed from this moment on all your devices.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteEntryMedia(m.id);
          await load();
          onChanged();
        },
      },
    ]);

  const actions: SheetAction[] = [
    { icon: 'pencil-outline', label: 'Edit', onPress: () => { setMenu(false); router.push(`/entry/${e.id}`); } },
    { icon: 'image-plus', label: 'Add photos', onPress: () => { setMenu(false); onAddPhotos(); } },
    ...(menuPhoto != null && photos[menuPhoto]
      ? [{ icon: 'image-remove', label: photos.length > 1 ? 'Remove this photo' : 'Remove photo', onPress: () => { setMenu(false); removePhoto(photos[menuPhoto].media); } }]
      : photos.length === 1
        ? [{ icon: 'image-remove', label: 'Remove photo', onPress: () => { setMenu(false); removePhoto(photos[0].media); } }]
        : photos.length > 1
          ? [{ icon: 'image-remove', label: 'Remove a photo', hint: 'Long-press the photo you want to remove', onPress: () => setMenu(false) }]
          : []),
    ...(canShare ? [{ icon: 'share-variant-outline', label: 'Share to feed', onPress: () => { setMenu(false); router.push({ pathname: '/post/new', params: { entryId: e.id, tripId } }); } }] : []),
    { icon: 'delete-outline', label: 'Delete moment', danger: true, onPress: () => { setMenu(false); onDelete(); } },
  ];
  const openMenu = canEdit ? () => { setMenuPhoto(null); setMenu(true); } : undefined;
  const openPhotoMenu = (i: number) => (canEdit ? () => { setMenuPhoto(i); setMenu(true); } : undefined);

  /** One photo in the mosaic: tap to see it full screen; long-press for the moment's options. */
  const photo = (i: number, w: number, h: number, more = 0) => (
    <Pressable
      key={photos[i].media.id}
      onPress={() => setViewer(i)}
      onLongPress={openPhotoMenu(i)}
      delayLongPress={350}
      accessibilityLabel={`Photo ${i + 1} of ${photos.length}, ${a11yWhen}. Tap to enlarge${canEdit ? ', long press for options' : ''}.`}
      style={{ width: w, height: h }}
    >
      <Image source={{ uri: photos[i].uri }} style={{ width: w, height: h }} contentFit="cover" transition={150} />
      {more ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#00000059', alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>+{more}</Text>
        </View>
      ) : null}
    </Pressable>
  );

  /** One photo 4:3; two side by side; three or more: one big on the left, two stacked on the right. */
  const mosaic = () => {
    if (!photos.length || !width) return null;
    const n = photos.length;
    if (n === 1) return photo(0, width, Math.round((width * 3) / 4));
    if (n === 2) {
      const w = (width - GAP) / 2;
      const h = Math.round(width * 0.65);
      return (
        <View style={{ flexDirection: 'row', gap: GAP }}>
          {photo(0, w, h)}
          {photo(1, w, h)}
        </View>
      );
    }
    const h = Math.round((width * 3) / 4);
    const bigW = Math.round(((width - GAP) * 2) / 3);
    const smallW = width - GAP - bigW;
    const smallH = (h - GAP) / 2;
    return (
      <View style={{ flexDirection: 'row', gap: GAP }}>
        {photo(0, bigW, h)}
        <View style={{ gap: GAP }}>
          {photo(1, smallW, smallH)}
          {photo(2, smallW, smallH, n > 3 ? n - 3 : 0)}
        </View>
      </View>
    );
  };

  const meta = [
    hasLocation ? (
      <View key="place" style={styles.metaItem} accessible accessibilityLabel={e.place_name ? `Place: ${e.place_name}` : 'Location saved'}>
        <Icon name="map-marker" size={14} color={colors.muted} />
        {e.place_name ? <Text style={[styles.metaText, { color: colors.muted }]} numberOfLines={1}>{e.place_name}</Text> : null}
      </View>
    ) : null,
    wx ? (
      <View key="wx" style={styles.metaItem} accessible accessibilityLabel={`Weather: ${e.weather}`}>
        <Icon name={wx.icon} size={14} color={colors.muted} />
        <Text style={[styles.metaText, { color: colors.muted }]}>{wx.label}</Text>
      </View>
    ) : null,
    money ? (
      <View key="money" style={styles.metaItem}>
        <Icon name="cash" size={14} color={colors.muted} />
        <Text style={[styles.metaText, { color: colors.muted }]}>{formatMoney(money, currencySymbol)}</Text>
      </View>
    ) : null,
  ].filter(Boolean);

  const hasBody = Boolean(body || hasVoice || meta.length);
  return (
    <Pressable
      onLongPress={openMenu}
      delayLongPress={350}
      disabled={!openMenu}
      accessibilityActions={canEdit ? [{ name: 'longpress', label: 'Moment options' }] : undefined}
      onAccessibilityAction={ev => ev.nativeEvent.actionName === 'longpress' && openMenu?.()}
      style={[
        styles.card,
        { backgroundColor: colors.surface },
        dark ? { borderWidth: 1, borderColor: colors.border } : styles.shadow,
      ]}
    >
      {/* Top: who (in a shared journey), the time, the mood; ⋯ for options. */}
      <View style={styles.head}>
        {author ? <Text style={{ fontWeight: '800', fontSize: 13.5, color: colors.primary }} numberOfLines={1}>{author}</Text> : null}
        <Text style={{ fontWeight: '800', fontSize: 13.5, color: colors.onSurface }} accessibilityLabel={a11yWhen}>
          {time}
        </Text>
        {emoji ? (
          <View style={{ paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999, backgroundColor: moodColors.bg }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={{ fontSize: 12, fontWeight: '700', color: moodColors.fg }}>{`${emoji} ${moodWord}`.trim()}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        {canEdit ? <IconButton icon="dots-horizontal" size={20} onPress={() => { setMenuPhoto(null); setMenu(true); }} accessibilityLabel="Moment options" style={{ margin: -6 }} iconColor={colors.subtle} /> : null}
      </View>

      {/* The photos across the full width of the tile, with their own rounded corners. */}
      {photos.length ? (
        <View onLayout={(ev: LayoutChangeEvent) => setWidth(ev.nativeEvent.layout.width)} style={{ borderRadius: PHOTO_RADIUS, overflow: 'hidden', backgroundColor: colors.surfaceVariant, minHeight: width ? undefined : 200 }}>
          {mosaic()}
        </View>
      ) : null}

      {hasBody ? (
        <View style={[styles.body, photos.length ? null : { paddingTop: 0 }]}>
          {body ? (
            <Pressable onPress={folds ? () => setExpanded(x => !x) : undefined} onLongPress={openMenu} disabled={!folds && !openMenu} accessibilityRole={folds ? 'button' : undefined} accessibilityHint={folds ? (expanded ? 'Shows less of this moment' : 'Shows the whole moment') : undefined}>
              <Text style={big ? styles.bigText : styles.text} numberOfLines={folds && !expanded ? FOLD_LINES : undefined}>
                {splitMentions(body).map((part, i) =>
                  part.mention ? (
                    <Text key={i} style={{ color: colors.primary, fontWeight: '700' }}>
                      {part.text}
                    </Text>
                  ) : (
                    part.text
                  )
                )}
              </Text>
              {folds ? <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13.5, marginTop: 4 }}>{expanded ? 'Show less' : 'Read more'}</Text> : null}
            </Pressable>
          ) : null}
          {hasVoice ? <EntryVoiceNotes entryId={e.id} refreshKey={mediaKey} inset={0} canEdit={canEdit} /> : null}
          {meta.length ? <View style={styles.meta}>{meta}</View> : null}
        </View>
      ) : null}

      {canEdit ? (
        <Sheet visible={menu} onDismiss={() => setMenu(false)} title="Moment" subtitle={menuPhoto != null && photos.length > 1 ? `${time} · photo ${menuPhoto + 1} of ${photos.length}` : body ? `${time} · ${body.split('\n')[0].slice(0, 60)}` : time}>
          <SheetActions actions={actions} />
        </Sheet>
      ) : null}
      <PhotoViewer uris={photos.map(p => p.uri)} index={viewer} onClose={() => setViewer(null)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, marginBottom: 14 },
  shadow: { shadowColor: '#1e0a32', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 10, minHeight: 44 },
  body: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 8 },
  text: { fontSize: 15.5, lineHeight: 23 },
  bigText: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  metaText: { fontSize: 12.5, fontWeight: '500' },
});
