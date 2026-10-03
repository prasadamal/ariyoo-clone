import { Audio } from 'expo-av';
import { v4 as uuid } from 'uuid';
import { upsertEntryMedia } from './localDb';

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

export async function stopVoiceRecordingAndSave(tripId: string, entryId: string) {
  if (!activeRecording) return;
  await activeRecording.stopAndUnloadAsync();
  const uri = activeRecording.getURI();
  activeRecording = null;
  if (!uri) return;
  const now = new Date().toISOString();
  await upsertEntryMedia({
    id: uuid(),
    trip_id: tripId,
    entry_id: entryId,
    local_uri: uri,
    storage_path: null,
    mime_type: 'audio/m4a',
    sync_status: 'pending',
    updated_at: now,
  });
}

export function isRecordingVoice() {
  return activeRecording != null;
}
