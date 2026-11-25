import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '../theme';
import { Icon } from '../ui/Icon';
import { deleteEntryMedia, listEntryMedia, type LocalEntryMedia } from '../lib/localDb';
import { isAudio, resolveMediaUri } from '../lib/media';

export function EntryVoiceNotes({ entryId, refreshKey = 0, inset = 14, canEdit = true }: { entryId: string; refreshKey?: number; inset?: number; canEdit?: boolean }) {
  const { colors } = useAppTheme();
  const [clips, setClips] = useState<LocalEntryMedia[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const player = useRef<AudioPlayer | null>(null);

  const load = useCallback(async () => {
    setClips((await listEntryMedia(entryId)).filter(m => isAudio(m.mime_type)));
  }, [entryId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const release = () => {
    const p = player.current;
    player.current = null;
    try {
      p?.remove();
    } catch {
      // already released
    }
  };

  useEffect(() => release, []);

  const stop = async () => {
    release();
    setPlaying(null);
  };

  const play = async (clip: LocalEntryMedia) => {
    if (playing === clip.id) return stop();
    await stop();
    const uri = await resolveMediaUri(clip);
    if (!uri) {
      Alert.alert('Voice note', 'This clip is not available offline yet. Connect to the internet to play it.');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const p = createAudioPlayer({ uri });
      player.current = p;
      p.addListener('playbackStatusUpdate', st => {
        if (st.didJustFinish && player.current === p) stop();
      });
      p.play();
      setPlaying(clip.id);
    } catch {
      release();
      setPlaying(null);
      Alert.alert('Voice note', 'Could not play this clip.');
    }
  };

  const remove = (clip: LocalEntryMedia) =>
    Alert.alert('Delete voice note?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEntryMedia(clip.id);
          load();
        },
      },
    ]);

  if (!clips.length) return null;

  // Small pills inside the card's padding (the old outlined buttons were tall and sat on its edge).
  return (
    <View style={{ marginTop: 10, paddingHorizontal: inset, gap: 8, flexDirection: 'row', flexWrap: 'wrap' }}>
      {clips.map((c, i) => {
        const on = playing === c.id;
        return (
          <Pressable
            key={c.id}
            onPress={() => play(c)}
            onLongPress={canEdit ? () => remove(c) : undefined}
            accessibilityRole="button"
            accessibilityLabel={`${on ? 'Stop' : 'Play'} voice note ${i + 1}`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              height: 32,
              paddingLeft: 10,
              paddingRight: 14,
              borderRadius: 16,
              backgroundColor: on ? colors.primary : colors.primaryContainer,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Icon name={on ? 'stop' : 'play'} size={16} color={on ? colors.onPrimary : colors.primary} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: on ? colors.onPrimary : colors.onPrimaryContainer }}>
              Voice note{clips.length > 1 ? ` ${i + 1}` : ''}
            </Text>
            <Icon name="waveform" size={16} color={on ? colors.onPrimary : colors.primary} />
          </Pressable>
        );
      })}
    </View>
  );
}
