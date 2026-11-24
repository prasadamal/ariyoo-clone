import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import { supabase } from '../lib/supabase';
import { useAppTheme } from '../theme';
import { Icon } from '../ui/Icon';

type Announcement = { id: number; message: string; tone: 'info' | 'warning' };

const LAST_KEY = 'wayfare_announcement_last_v1';
const DISMISSED_KEY = 'wayfare_announcement_dismissed_v1';

/** The newest announcement, or null. Offline (or before the table exists) it keeps the last one seen. */
async function loadAnnouncement(): Promise<Announcement | null> {
  if (supabase) {
    const { data, error } = await supabase.rpc('current_announcement');
    if (!error) {
      const a = (Array.isArray(data) ? data[0] : null) as Announcement | null;
      await AsyncStorage.setItem(LAST_KEY, JSON.stringify(a)).catch(() => undefined);
      return a;
    }
  }
  try {
    return JSON.parse((await AsyncStorage.getItem(LAST_KEY)) ?? 'null') as Announcement | null;
  } catch {
    return null;
  }
}

/**
 * One short message from the Wayfare team at the top of Journeys (set in the admin console).
 * Closing it hides that message on this phone; a new message shows again.
 */
/** onHeight: the room it takes (0 when hidden), so the page can size what's below. */
export function AnnouncementBanner({ onHeight }: { onHeight?: (h: number) => void }) {
  const { colors, dark } = useAppTheme();
  const [item, setItem] = useState<Announcement | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([loadAnnouncement(), AsyncStorage.getItem(DISMISSED_KEY).catch(() => null)])
        .then(([a, dismissed]) => alive && setItem(a && String(a.id) !== dismissed ? a : null))
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, [])
  );

  useEffect(() => {
    if (!item) onHeight?.(0);
  }, [item, onHeight]);

  if (!item) return null;
  const warning = item.tone === 'warning';
  const bg = warning ? (dark ? '#3a2a0c' : '#fdf0dc') : colors.primaryContainer;
  const fg = warning ? (dark ? '#fbbf24' : '#7c3d06') : colors.onPrimaryContainer;
  const dismiss = () => {
    AsyncStorage.setItem(DISMISSED_KEY, String(item.id)).catch(() => undefined);
    setItem(null);
  };
  return (
    <View
      onLayout={e => onHeight?.(e.nativeEvent.layout.height + 10)}
      accessibilityRole="alert"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: bg, borderRadius: 14, paddingLeft: 12, paddingVertical: 8, marginTop: 10 }}
    >
      <Icon name={warning ? 'alert-circle-outline' : 'bullhorn-outline'} size={18} color={fg} />
      <Text style={{ flex: 1, color: fg, fontWeight: '600', fontSize: 13 }}>{item.message}</Text>
      <Pressable onPress={dismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close this message" style={{ padding: 8 }}>
        <Icon name="close" size={16} color={fg} />
      </Pressable>
    </View>
  );
}
