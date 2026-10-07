import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, type AudioRecorder } from 'expo-audio';
import { uuid } from './id';
import { upsertEntryMedia } from './localDb';
import { persistVoiceNote } from './media';

/** AAC in an .m4a container on both platforms. Pass to `useAudioRecorder`. */
export const VOICE_NOTE_PRESET = RecordingPresets.HIGH_QUALITY;

export async function startVoiceRecording(recorder: AudioRecorder) {
  const perm = await requestRecordingPermissionsAsync();
  if (!perm.granted) throw new Error('Microphone permission is required for voice notes.');
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
  await recorder.prepareToRecordAsync();
  recorder.record();
}

/** Stops, moves the clip out of the cache directory and attaches it to the entry. */
export async function stopVoiceRecordingAndSave(recorder: AudioRecorder, tripId: string, entryId: string) {
  await recorder.stop();
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
  const uri = recorder.uri;
  if (!uri) throw new Error('The voice note could not be saved.');
  const mediaId = uuid();
  const stored = await persistVoiceNote(uri, mediaId);
  await upsertEntryMedia({
    id: mediaId,
    trip_id: tripId,
    entry_id: entryId,
    local_uri: stored,
    storage_path: null,
    mime_type: 'audio/m4a',
    sync_status: 'pending',
    updated_at: new Date().toISOString(),
  });
}

export async function cancelVoiceRecording(recorder: AudioRecorder) {
  try {
    if (recorder.isRecording) await recorder.stop();
  } catch {
    // already released with its screen
  }
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
}
