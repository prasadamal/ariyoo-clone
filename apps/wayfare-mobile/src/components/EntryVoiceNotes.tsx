import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button } from 'react-native-paper';
import { deleteEntryMedia, listEntryMedia, type LocalEntryMedia } from '../lib/localDb';
import { isAudio, resolveMediaUri } from '../lib/media';

export function EntryVoiceNotes({ entryId, refreshKey = 0 }: { entryId: string; refreshKey?: number }) {
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

  return (
    <View style={{ marginTop: 8, gap: 6, flexDirection: 'row', flexWrap: 'wrap' }}>
      {clips.map((c, i) => (
        <Button
          key={c.id}
          mode={playing === c.id ? 'contained-tonal' : 'outlined'}
          icon={playing === c.id ? 'stop' : 'play'}
          onPress={() => play(c)}
          onLongPress={() => remove(c)}
          compact
          accessibilityLabel={`${playing === c.id ? 'Stop' : 'Play'} voice note ${i + 1}`}
        >
          Voice note{clips.length > 1 ? ` ${i + 1}` : ''}
        </Button>
      ))}
    </View>
  );
}
