import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, type AudioRecorder } from 'expo-audio';
import { uuid } from './id';
import { getEntry, upsertEntryMedia } from './localDb';
import { persistVoiceNote } from './media';
import { withJournalLock } from './journalGate';
import { createRecordingLifecycle } from './recordingLifecycle';

/** AAC in an .m4a container on both platforms. Pass to `useAudioRecorder`. */
export const VOICE_NOTE_PRESET = RecordingPresets.HIGH_QUALITY;
const recording = createRecordingLifecycle<AudioRecorder>({
  permission: async () => (await requestRecordingPermissionsAsync()).granted,
  enable: () => setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }),
  disable: () => setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }),
  prepare: recorder => recorder.prepareToRecordAsync(),
  record: recorder => recorder.record(),
  stop: async recorder => {
    try { await recorder.stop(); }
    catch (error) {
      // Hook cleanup may already have released a screen's recorder.
      let recording = false;
      try { recording = recorder.isRecording; } catch { return; }
      if (recording) throw error;
    }
  },
});

export const startVoiceRecording = recording.start;
export const cancelVoiceRecording = recording.cancel;
export const cancelActiveVoiceRecording = recording.cancelActive;

/** Replication/wipe cannot interleave with committing a stopped voice note. */
export function stopVoiceRecordingAndSave(recorder: AudioRecorder, tripId: string, entryId: string) {
  return recording.save(recorder, isCurrent => withJournalLock(async () => {
    if (!isCurrent()) throw new Error('Recording cancelled.');
    const entry = await getEntry(entryId);
    if (!entry || entry.trip_id !== tripId || !isCurrent()) throw new Error('This moment is no longer available.');
    const uri = recorder.uri;
    if (!uri) throw new Error('The voice note could not be saved.');
    const mediaId = uuid();
    const stored = await persistVoiceNote(uri, mediaId);
    if (!isCurrent()) throw new Error('Recording cancelled.');
    await upsertEntryMedia({
      id: mediaId, trip_id: tripId, entry_id: entryId, local_uri: stored,
      storage_path: null, mime_type: 'audio/m4a', sync_status: 'pending', updated_at: new Date().toISOString(),
    });
  }));
}
