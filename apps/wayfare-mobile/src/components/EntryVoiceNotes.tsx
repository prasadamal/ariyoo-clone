import { Audio } from 'expo-av';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-paper';
import { listEntryMedia, type LocalEntryMedia } from '../lib/localDb';

export function EntryVoiceNotes({ entryId }: { entryId: string }) {
  const [clips, setClips] = useState<LocalEntryMedia[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);

  const reload = () =>
    listEntryMedia(entryId).then(all =>
      setClips(all.filter(m => (m.mime_type ?? '').startsWith('audio')))
    );

  useEffect(() => {
    reload();
  }, [entryId]);

  const play = async (clip: LocalEntryMedia) => {
    try {
      setPlaying(clip.id);
      const { sound } = await Audio.Sound.createAsync({ uri: clip.local_uri });
      sound.setOnPlaybackStatusUpdate(st => {
        if (st.isLoaded && st.didJustFinish) {
          sound.unloadAsync();
          setPlaying(null);
        }
      });
      await sound.playAsync();
    } catch {
      setPlaying(null);
    }
  };

  if (!clips.length) return null;

  return (
    <View style={{ marginTop: 8, gap: 6 }}>
      {clips.map(c => (
        <Button
          key={c.id}
          mode="outlined"
          icon="microphone"
          loading={playing === c.id}
          onPress={() => play(c)}
          compact
        >
          Play voice note
        </Button>
      ))}
    </View>
  );
}
