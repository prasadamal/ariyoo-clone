import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, IconButton } from 'react-native-paper';
import { useSync } from '../context/SyncContext';
import { deleteEntryMedia, listEntryMedia, type LocalEntryMedia } from '../lib/localDb';
import { deleteLocalFile, getSignedMediaUrl } from '../lib/media';

function Clip({ clip, onDelete }: { clip: LocalEntryMedia; onDelete: () => void }) {
  const [uri, setUri] = useState<string | null>(clip.local_uri || null);
  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (uri || !clip.storage_path) return;
    getSignedMediaUrl(clip.storage_path).then(setUri);
  }, [clip.storage_path, uri]);

  const toggle = useCallback(() => {
    if (status.playing) player.pause();
    else {
      if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration)) player.seekTo(0);
      player.play();
    }
  }, [player, status]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Button mode="outlined" icon={status.playing ? 'pause' : 'play'} compact disabled={!uri} onPress={toggle} accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'}>
        {status.playing ? 'Pause' : 'Voice note'}
      </Button>
      <IconButton icon="delete-outline" size={18} onPress={onDelete} accessibilityLabel="Delete voice note" />
    </View>
  );
}

export function EntryVoiceNotes({ entryId }: { entryId: string }) {
  const { dataVersion, notifyLocalChange } = useSync();
  const [clips, setClips] = useState<LocalEntryMedia[]>([]);

  useEffect(() => {
    listEntryMedia(entryId).then(all => setClips(all.filter(m => m.kind === 'audio')));
  }, [entryId, dataVersion]);

  const remove = (clip: LocalEntryMedia) =>
    Alert.alert('Delete voice note', 'Remove this recording?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          deleteLocalFile(await deleteEntryMedia(clip.id));
          notifyLocalChange();
        },
      },
    ]);

  if (!clips.length) return null;
  return (
    <View style={{ marginTop: 8 }}>
      {clips.map(c => (
        <Clip key={c.id} clip={c} onDelete={() => remove(c)} />
      ))}
    </View>
  );
}
