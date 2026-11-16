import { stopLiveSharing, stopTripTracking } from './locationTask';
import { cancelActiveVoiceRecording } from './voiceNote';

/** Run before account exit or wiping the journal; failure leaves the action retryable. */
export async function stopDeviceActivity() {
  await cancelActiveVoiceRecording();
  await stopLiveSharing();
  await stopTripTracking();
}
