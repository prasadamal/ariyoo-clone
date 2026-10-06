import { Audio } from 'expo-av';
import { v4 as uuid } from 'uuid';
import { upsertEntryMedia } from './localDb';
import { persistVoiceNote } from './media';

let activeRecording: Audio.Recording | null = null;

export async function startVoiceRecording() {
  const perm = await Audio.requestPermissionsAsync();
  if (!perm.granted) throw new Error('Microphone permission is required for voice notes.');
  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await recording.startAsync();
  activeRecording = recording;
}

/** Stops, moves the clip out of the cache directory and attaches it to the entry. */
export async function stopVoiceRecordingAndSave(tripId: string, entryId: string) {
  if (!activeRecording) return;
  const recording = activeRecording;
  activeRecording = null;
  await recording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => undefined);
  const uri = recording.getURI();
  if (!uri) return;
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

export async function cancelVoiceRecording() {
  if (!activeRecording) return;
  const recording = activeRecording;
  activeRecording = null;
  await recording.stopAndUnloadAsync().catch(() => undefined);
}

export function isRecordingVoice() {
  return activeRecording != null;
}
