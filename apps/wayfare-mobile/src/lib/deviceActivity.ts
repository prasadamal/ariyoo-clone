import { stopLiveSharing, stopTripTracking, stopLocalLocationUpdates } from './locationTask';
import { cancelActiveVoiceRecording } from './voiceNote';

/** Run before account exit or wiping the journal; failure leaves the action retryable. */
export async function stopDeviceActivity() {
  await cancelActiveVoiceRecording();
  await stopLiveSharing();
  await stopTripTracking();
}

/** A different journal owner may own the retained live link: stop local collection so the
 * traveller can sign back into that owner account and revoke the link there. */
export async function stopLocalDeviceActivity() {
  await cancelActiveVoiceRecording();
  await stopLocalLocationUpdates();
}
