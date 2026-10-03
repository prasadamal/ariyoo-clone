import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { useCallback, useState } from 'react';
import { newId } from './id';
import { persistLocalFile } from './media';
import { upsertEntryMedia } from './localDb';

export class MicPermissionError extends Error {}

/** Hook around expo-audio's recorder. `stop()` resolves with the recorded file, or null. */
export function useVoiceNoteRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);

  const start = useCallback(async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) throw new MicPermissionError('Microphone permission is needed to record voice notes.');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  }, [recorder]);

  const stop = useCallback(async (): Promise<string | null> => {
    try {
      await recorder.stop();
      return recorder.uri;
    } finally {
      setRecording(false);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    }
  }, [recorder]);

  return { recording, start, stop };
}

/** Copies a finished recording into durable storage and queues it for sync. */
export async function saveVoiceNote(tripId: string, entryId: string, recordedUri: string) {
  const { uri, size } = persistLocalFile(recordedUri, 'audio/mp4');
  await upsertEntryMedia({
    id: newId(),
    trip_id: tripId,
    entry_id: entryId,
    local_uri: uri,
    storage_path: null,
    mime_type: 'audio/mp4',
    kind: 'audio',
    size_bytes: size,
    sync_status: 'pending',
    updated_at: new Date().toISOString(),
  });
}
