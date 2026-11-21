import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { IconButton, Menu, Text } from 'react-native-paper';
import { EntryVoiceNotes } from '../../components/EntryVoiceNotes';
import { MomentPhotos } from '../../components/MomentPhotos';
import type { LocalEntry } from '../../lib/localDb';
import { formatMoney } from '../../lib/momentMoney';
import { useAppTheme } from '../../theme';
import { Icon } from '../../ui/Icon';

type Props = {
  entry: LocalEntry;
  /** Total spent at this moment, if any. */
  money?: number;
  currencySymbol: string;
  mediaKey: number;
  canShare: boolean;
  tripId: string;
  onChanged: () => void;
  onAddPhotos: () => void;
  onDelete: () => void;
};

/** One moment: photo first (full width), then the words, then one line of details. */
export function MomentCard({ entry: e, money, currencySymbol, mediaKey, canShare, tripId, onChanged, onAddPhotos, onDelete }: Props) {
  const { colors } = useAppTheme();
  const [menu, setMenu] = useState(false);
  const time = new Date(e.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const hasLocation = Boolean(e.place_name) || (e.latitude != null && e.longitude != null);

  const detail = (icon: string, label: string, color = colors.onSurfaceVariant) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
      <Icon name={icon} size={14} color={color} />
      <Text style={{ color, fontSize: 13, flexShrink: 1 }} numberOfLines={1}>{label}</Text>
    </View>
  );

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, marginBottom: 14, overflow: 'hidden' }}>
      <MomentPhotos entryId={e.id} refreshKey={mediaKey} onChanged={onChanged} />

      {e.body && e.body !== '📷' && e.body !== '🎙 Voice note' ? (
        <Text style={{ paddingHorizontal: 14, paddingTop: 12, lineHeight: 22, fontSize: 16 }}>{e.body}</Text>
      ) : null}

      <EntryVoiceNotes entryId={e.id} refreshKey={mediaKey} />

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 2, paddingVertical: 4, minHeight: 44 }}>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 2 }}>
          {detail('clock-outline', e.sync_status === 'pending' ? `${time} · not synced` : time, colors.muted)}
          {hasLocation ? detail('map-marker', e.place_name ?? '', colors.secondary) : null}
          {e.mood ? <Text style={{ fontSize: 13 }}>{e.mood.split(' ')[0]}</Text> : null}
          {e.weather ? detail('weather-partly-cloudy', e.weather, colors.muted) : null}
          {money ? detail('cash', formatMoney(money, currencySymbol), colors.primary) : null}
        </View>
        <Menu
          visible={menu}
          onDismiss={() => setMenu(false)}
          anchor={<IconButton icon="dots-vertical" size={18} onPress={() => setMenu(true)} accessibilityLabel="Moment options" />}
        >
          <Menu.Item leadingIcon="pencil-outline" title="Edit" onPress={() => { setMenu(false); router.push(`/entry/${e.id}`); }} />
          <Menu.Item leadingIcon="image-plus" title="Add photos" onPress={() => { setMenu(false); onAddPhotos(); }} />
          {canShare ? (
            <Menu.Item
              leadingIcon="share-variant-outline"
              title="Share to feed"
              onPress={() => {
                setMenu(false);
                router.push({ pathname: '/post/new', params: { entryId: e.id, tripId } });
              }}
            />
          ) : null}
          <Menu.Item leadingIcon="delete-outline" title="Delete" onPress={() => { setMenu(false); onDelete(); }} />
        </Menu>
      </View>
    </View>
  );
}
