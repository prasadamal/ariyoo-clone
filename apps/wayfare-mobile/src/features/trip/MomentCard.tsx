import { router } from 'expo-router';
import { stripRich } from '../../lib/richText';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { EntryVoiceNotes } from '../../components/EntryVoiceNotes';
import { MomentPhotos } from '../../components/MomentPhotos';
import { formatDay, toDayString } from '../../lib/format';
import type { LocalEntry } from '../../lib/localDb';
import { formatMoney } from '../../lib/momentMoney';
import { useAppTheme } from '../../theme';
import { Icon } from '../../ui/Icon';
import { Sheet, SheetActions } from '../../ui/Sheet';
import { splitMentions } from '../../lib/mentions';

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

// Longer than this (or more lines) and the words fold behind "See more", so every card stays a similar size.
const FOLD_CHARS = 220;
const FOLD_LINES = 4;
const PLACEHOLDER_BODIES = new Set(['📷', '🎙 Voice note', '💰']);

/**
 * One moment, like a post without a name: a header (mood and when), the photos in one fixed window,
 * the words (folded when long), voice notes, then where and how much.
 */

export function MomentCard({ entry: e, money, currencySymbol, mediaKey, canShare, canEdit = true, author, tripId, onChanged, onAddPhotos, onDelete }: Props) {
  const { colors } = useAppTheme();
  const [menu, setMenu] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const at = new Date(e.recorded_at);
  const time = at.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const when = `${formatDay(toDayString(at), { year: at.getFullYear() !== new Date().getFullYear() })} · ${time}`;
  const hasLocation = Boolean(e.place_name) || (e.latitude != null && e.longitude != null);
  const body = e.body && !PLACEHOLDER_BODIES.has(e.body) ? stripRich(e.body) : '';
  const long = body.length > FOLD_CHARS || body.split('\n').length > FOLD_LINES;
  const emoji = e.mood ? e.mood.split(' ')[0] : null;
  const moodWord = e.mood ? e.mood.split(' ').slice(1).join(' ') : '';

  // Every detail in one quiet colour, the same as the time.
  const detail = (icon: string, label: string) => (
    <View key={icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
      <Icon name={icon} size={14} color={colors.muted} />
      <Text style={{ color: colors.muted, fontSize: 13, flexShrink: 1 }} numberOfLines={1}>{label}</Text>
    </View>
  );
  // A location without a place name: just the pin, no words.
  const pin = (
    <View key="pin" accessible accessibilityLabel="Location saved">
      <Icon name="map-marker-outline" size={14} color={colors.muted} />
    </View>
  );
  const details = [
    hasLocation && e.place_name ? detail('map-marker-outline', e.place_name) : hasLocation ? pin : null,
    e.weather ? detail('weather-partly-cloudy', e.weather) : null,
    money ? detail('currency-inr', formatMoney(money, currencySymbol)) : null,
  ].filter(Boolean);

  const toggle = long ? () => setExpanded(x => !x) : undefined;
  return (
    // An open page, not a box: the time and mood, photos as wide as the page, the words in a
    // reading size, then where and how much. Tapping a long moment anywhere opens or folds it.
    <Pressable
      onPress={toggle}
      disabled={!long}
      accessibilityRole={long ? 'button' : undefined}
      accessibilityHint={long ? (expanded ? 'Shows less of this moment' : 'Shows the whole moment') : undefined}
      style={{ marginBottom: 22, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 40 }}>
        {emoji ? <Text style={{ fontSize: 20, marginRight: 8 }}>{emoji}</Text> : null}
        <View style={{ flex: 1 }}>
          {author ? (
            <Text style={{ fontWeight: '700', fontSize: 14, color: colors.primary }} numberOfLines={1}>
              {author}
            </Text>
          ) : null}
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600' }} accessibilityLabel={e.mood ? `${when}, mood ${moodWord}` : when}>
            {when}
            {moodWord ? <Text style={{ color: colors.muted, fontWeight: '400' }}>{`  ·  ${moodWord}`}</Text> : null}
          </Text>
        </View>
        {canEdit ? <IconButton icon="dots-horizontal" size={20} onPress={() => setMenu(true)} accessibilityLabel="Moment options" style={{ margin: 0 }} /> : null}
      </View>

      <MomentPhotos entryId={e.id} refreshKey={mediaKey} onChanged={onChanged} canEdit={canEdit} inset={0} />

      {body ? (
        <View style={{ paddingTop: 10 }}>
          <Text style={{ lineHeight: 26, fontSize: 17 }} numberOfLines={long && !expanded ? FOLD_LINES : undefined}>
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
          {long ? (
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14, marginTop: 4 }} accessibilityElementsHidden>
              {expanded ? 'Show less' : 'Read more'}
            </Text>
          ) : null}
        </View>
      ) : null}

      <EntryVoiceNotes entryId={e.id} refreshKey={mediaKey} inset={0} />

      {details.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4, paddingTop: 10 }}>
          {details}
        </View>
      ) : null}
      {canEdit ? (
        // The moment's options slide up from the bottom: big rows, easy to hit with a thumb.
        <Sheet visible={menu} onDismiss={() => setMenu(false)} title="Moment" subtitle={body ? `${when} · ${body.split('\n')[0].slice(0, 60)}` : when}>
          <SheetActions
            actions={[
              { icon: 'pencil-outline', label: 'Edit', onPress: () => { setMenu(false); router.push(`/entry/${e.id}`); } },
              { icon: 'image-plus', label: 'Add photos', onPress: () => { setMenu(false); onAddPhotos(); } },
              ...(canShare
                ? [{ icon: 'share-variant-outline', label: 'Share to feed', onPress: () => { setMenu(false); router.push({ pathname: '/post/new', params: { entryId: e.id, tripId } }); } }]
                : []),
              { icon: 'delete-outline', label: 'Delete', danger: true, onPress: () => { setMenu(false); onDelete(); } },
            ]}
          />
        </Sheet>
      ) : null}
    </Pressable>
  );
}
