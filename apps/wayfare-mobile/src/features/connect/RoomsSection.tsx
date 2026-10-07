import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Button, Searchbar, Text } from 'react-native-paper';
import { useInbox } from '../../context/InboxContext';
import { useToast } from '../../context/ToastContext';
import { inSeason } from '../../lib/places';
import { joinPlaceRoom, placeRooms } from '../../social/chat';
import type { PlaceRoom } from '../../social/types';
import { useAppTheme } from '../../theme';
import { Icon } from '../../ui/Icon';
import { SectionHeader } from '../../ui/SectionHeader';

export function RoomsSection() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const { refresh } = useInbox();
  const [query, setQuery] = useState('');
  const [rooms, setRooms] = useState<PlaceRoom[]>([]);
  const seasonal = inSeason(new Date().getMonth() + 1).slice(0, 8);

  const load = useCallback(async () => {
    setRooms(await placeRooms(query).catch(() => []));
  }, [query]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const join = async (placeKey: string, title: string) => {
    try {
      const id = await joinPlaceRoom(placeKey, title);
      refresh();
      router.push(`/chat/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not join room');
    }
  };

  const existingKeys = new Set(rooms.map(r => r.place_key));

  return (
    <FlatList
      data={rooms}
      keyExtractor={r => r.id}
      contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 60 }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View>
          <Searchbar placeholder="Find a destination room" value={query} onChangeText={setQuery} style={{ marginBottom: 6 }} />
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>
            Live group chats per destination — ask about trail conditions, permits, rides and meetups.
          </Text>
        </View>
      }
      ListFooterComponent={
        !query ? (
          <View>
            <SectionHeader title="Start a room" subtitle="In season right now" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {seasonal
                .filter(d => !existingKeys.has(d.key))
                .map(d => (
                  <Button key={d.key} mode="outlined" compact icon="plus" onPress={() => join(d.key, d.name)}>
                    {d.name}
                  </Button>
                ))}
            </View>
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => (item.joined ? router.push(`/chat/${item.id}`) : join(item.place_key, item.title))}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}
          accessibilityRole="button"
          accessibilityLabel={`${item.title} room, ${item.member_count} members`}
        >
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="map-marker-radius" size={22} color={colors.onSecondaryContainer} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700' }}>{item.title}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
              {item.member_count} traveller{item.member_count === 1 ? '' : 's'}
              {item.joined && item.last_message_preview ? ` · ${item.last_message_preview}` : ''}
            </Text>
          </View>
          <Text style={{ color: item.joined ? colors.secondary : colors.primary, fontWeight: '700' }}>{item.joined ? 'Open' : 'Join'}</Text>
        </Pressable>
      )}
    />
  );
}
