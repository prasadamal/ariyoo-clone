import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Text } from 'react-native-paper';
import { EntryVoiceNotes } from '../../components/EntryVoiceNotes';
import { deleteEntryMedia, listEntryMedia, type LocalEntry, type LocalEntryMedia } from '../../lib/localDb';
import { isAudio, resolveMediaUri } from '../../lib/media';
import { splitMentions } from '../../lib/mentions';
import { foldsMoment, isShortMoment, moodTint, shortWeather } from '../../lib/momentStyle';
import { formatMoney } from '../../lib/momentMoney';
import { stripRich } from '../../lib/richText';
import { useAppTheme } from '../../theme';
import { Glass } from '../../ui/Glass';
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
  /** The page's side padding, so photos can run edge to edge. */
  bleed?: number;
};

const PLACEHOLDER_BODIES = new Set(['📷', '🎙 Voice note', '💰']);
const FOLD_LINES_ON_BAND = 3;
const FOLD_LINES_ON_CARD = 6;

/**
 * One moment in the Stories view. With photos: the photos edge to edge (4:5, swipe for more, the
 * time and mood on a glass chip), then the words, voice notes, place and weather on a band under
 * the photo, made from the same photo blurred and darkened, so white words read on any picture.
 * Without photos: a card in the mood's colour; short words are set big. Tap the words to open or
 * fold them, tap a photo to see it full screen, long-press the moment for Edit / Add photos / Delete.
 */
export function MomentStory({ entry: e, money, currencySymbol, mediaKey, canShare, canEdit = true, author, tripId, onChanged, onAddPhotos, onDelete, bleed = 16 }: Props) {
  const { colors, dark } = useAppTheme();
  const [photos, setPhotos] = useState<{ media: LocalEntryMedia; uri: string }[]>([]);
  const [hasVoice, setHasVoice] = useState(false);
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
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
    setPage(p => Math.min(p, Math.max(0, resolved.length - 1)));
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
  const wx = shortWeather(e.weather);
  const hasLocation = Boolean(e.place_name) || (e.latitude != null && e.longitude != null);
  const chipLabel = [author, time, emoji ? `${emoji} ${moodWord}`.trim() : null].filter(Boolean).join(' · ');
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
    ...(photos[page] ? [{ icon: 'image-remove', label: photos.length > 1 ? `Remove photo ${page + 1}` : 'Remove photo', onPress: () => { setMenu(false); removePhoto(photos[page].media); } }] : []),
    ...(canShare ? [{ icon: 'share-variant-outline', label: 'Share to feed', onPress: () => { setMenu(false); router.push({ pathname: '/post/new', params: { entryId: e.id, tripId } }); } }] : []),
    { icon: 'delete-outline', label: 'Delete moment', danger: true, onPress: () => { setMenu(false); onDelete(); } },
  ];
  const openMenu = canEdit ? () => setMenu(true) : undefined;

  /** The words, with @mentions in bold; long ones fold and open on a tap. */
  const words = (color: string, mentionColor: string, lines: number, big: boolean) =>
    body ? (
      <Pressable onPress={folds ? () => setExpanded(x => !x) : undefined} onLongPress={openMenu} disabled={!folds && !openMenu} accessibilityRole={folds ? 'button' : undefined} accessibilityHint={folds ? (expanded ? 'Shows less of this moment' : 'Shows the whole moment') : undefined}>
        <Text
          style={big ? { color, fontSize: 28, lineHeight: 33, fontWeight: '800', letterSpacing: -0.3 } : { color, fontSize: 16.5, lineHeight: 25 }}
          numberOfLines={folds && !expanded ? lines : undefined}
        >
          {splitMentions(body).map((part, i) =>
            part.mention ? (
              <Text key={i} style={{ color: mentionColor, fontWeight: '800' }}>
                {part.text}
              </Text>
            ) : (
              part.text
            )
          )}
        </Text>
        {folds ? <Text style={{ color, fontWeight: '800', fontSize: 13.5, marginTop: 6, textDecorationLine: 'underline' }}>{expanded ? 'Show less' : 'Read more'}</Text> : null}
      </Pressable>
    ) : null;

  /** Where, the weather and what it cost, in one quiet line. */
  const meta = (color: string) => {
    const parts = [
      hasLocation ? (
        <View key="place" style={styles.metaItem} accessible accessibilityLabel={e.place_name ? `Place: ${e.place_name}` : 'Location saved'}>
          <Icon name="map-marker" size={14} color={color} />
          {e.place_name ? <Text style={[styles.metaText, { color }]} numberOfLines={1}>{e.place_name}</Text> : null}
        </View>
      ) : null,
      wx ? (
        <View key="wx" style={styles.metaItem} accessible accessibilityLabel={`Weather: ${e.weather}`}>
          <Icon name={wx.icon} size={14} color={color} />
          <Text style={[styles.metaText, { color }]}>{wx.label}</Text>
        </View>
      ) : null,
      money ? (
        <View key="money" style={styles.metaItem}>
          <Icon name="cash" size={14} color={color} />
          <Text style={[styles.metaText, { color }]}>{formatMoney(money, currencySymbol)}</Text>
        </View>
      ) : null,
    ].filter(Boolean);
    return parts.length ? <View style={styles.meta}>{parts}</View> : null;
  };

  const onLayout = (ev: LayoutChangeEvent) => setWidth(ev.nativeEvent.layout.width);
  const onScroll = (ev: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width) setPage(Math.round(ev.nativeEvent.contentOffset.x / width));
  };
  const a11yActions = canEdit ? [{ name: 'longpress', label: 'Moment options' }] : undefined;
  const menuSheet = canEdit ? (
    <Sheet visible={menu} onDismiss={() => setMenu(false)} title="Moment" subtitle={body ? `${time} · ${body.split('\n')[0].slice(0, 60)}` : time}>
      <SheetActions actions={actions} />
    </Sheet>
  ) : null;

  // ---- With photos: the photo edge to edge, the words on a band under it ----
  if (photos.length) {
    const many = photos.length > 1;
    const band = Boolean(body || hasVoice || hasLocation || wx || money);
    return (
      <View
        style={{ marginHorizontal: -bleed, marginBottom: 8 }}
        onLayout={onLayout}
        accessibilityActions={a11yActions}
        onAccessibilityAction={ev => ev.nativeEvent.actionName === 'longpress' && setMenu(true)}
      >
        <View style={{ aspectRatio: 4 / 5, backgroundColor: colors.surfaceVariant }}>
          {width ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={32} scrollEnabled={many}>
              {photos.map((p, i) => (
                <Pressable
                  key={p.media.id}
                  onPress={() => setViewer(i)}
                  onLongPress={openMenu}
                  delayLongPress={350}
                  accessibilityLabel={`Photo ${i + 1} of ${photos.length}, ${a11yWhen}. Tap to enlarge${canEdit ? ', long press for options' : ''}.`}
                >
                  <Image source={{ uri: p.uri }} style={{ width, aspectRatio: 4 / 5 }} contentFit="cover" transition={150} />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          {/* A soft shade at the top so the chip reads on a bright sky. */}
          <LinearGradient pointerEvents="none" colors={['#00000059', '#00000000']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 90 }} />
          <Glass variant="media" radius={999} pointerEvents="none" style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1} accessibilityLabel={a11yWhen}>
              {chipLabel}
            </Text>
          </Glass>
          {many ? (
            <>
              <Glass variant="media" radius={999} pointerEvents="none" style={styles.counter}>
                <Text style={styles.chipText}>
                  {page + 1}/{photos.length}
                </Text>
              </Glass>
              <View pointerEvents="none" style={styles.dots}>
                {photos.map((p, i) => (
                  <View key={p.media.id} style={[styles.dot, { backgroundColor: i === page ? '#ffffff' : '#ffffff80' }]} />
                ))}
              </View>
            </>
          ) : null}
        </View>

        {band ? (
          <Pressable onLongPress={openMenu} disabled={!openMenu} style={{ overflow: 'hidden' }}>
            {/* The same photo, blurred and darkened: the band feels part of the picture. */}
            <Image source={{ uri: photos[0].uri }} blurRadius={40} style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.6 }] }]} contentFit="cover" />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0c0612b3' }]} />
            <View style={{ paddingHorizontal: bleed + 2, paddingTop: 14, paddingBottom: 18, gap: 10 }}>
              {words('#ffffff', '#e9c9ff', FOLD_LINES_ON_BAND, isShortMoment(body))}
              {hasVoice ? <EntryVoiceNotes entryId={e.id} refreshKey={mediaKey} inset={0} tone="onDark" canEdit={canEdit} /> : null}
              {meta('#ffffffcc')}
            </View>
          </Pressable>
        ) : null}
        {menuSheet}
        <PhotoViewer uris={photos.map(p => p.uri)} index={viewer} onClose={() => setViewer(null)} />
      </View>
    );
  }

  // ---- Words only: a card in the mood's colour ----
  const tint = moodTint(e.mood, dark);
  return (
    <Pressable
      onLongPress={openMenu}
      delayLongPress={350}
      disabled={!openMenu}
      accessibilityActions={a11yActions}
      onAccessibilityAction={ev => ev.nativeEvent.actionName === 'longpress' && setMenu(true)}
      style={{ marginHorizontal: -bleed, marginBottom: 8, backgroundColor: tint.bg, paddingHorizontal: bleed + 6, paddingTop: 14, paddingBottom: 22, gap: 12 }}
    >
      <View style={[styles.chip, styles.chipStatic, { backgroundColor: tint.chip }]}>
        <Text style={[styles.chipText, { color: tint.fg }]} numberOfLines={1} accessibilityLabel={a11yWhen}>
          {chipLabel}
        </Text>
      </View>
      {words(tint.fg, tint.fg, FOLD_LINES_ON_CARD, isShortMoment(body))}
      {hasVoice ? <EntryVoiceNotes entryId={e.id} refreshKey={mediaKey} inset={0} canEdit={canEdit} /> : null}
      {meta(tint.fg)}
      {menuSheet}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { position: 'absolute', top: 12, left: 12, maxWidth: '78%', paddingHorizontal: 11, paddingVertical: 5 },
  chipStatic: { position: 'relative', top: 0, left: 0, alignSelf: 'flex-start', borderRadius: 999 },
  chipText: { color: '#ffffff', fontSize: 12.5, fontWeight: '700' },
  counter: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 9, paddingVertical: 4 },
  dots: { position: 'absolute', left: 0, right: 0, bottom: 10, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  metaText: { fontSize: 13, fontWeight: '600' },
});
