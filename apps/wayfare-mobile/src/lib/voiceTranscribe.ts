import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Platform } from 'react-native';
import { transcriptFrom } from './transcript';

/**
 * "Write out voice notes" (beta, off by default): the voice note is recorded by the phone's speech
 * recogniser, which also writes down what was said. The audio is a .wav file kept like any voice
 * note; the words go into the moment's text, so they show up and can be searched.
 * Needs Android 13+ or iOS; elsewhere the normal recorder is used.
 */
const KEY = 'wayfare_voice_write_out_v1';

export function writeOutSupported() {
  if (Platform.OS === 'web') return false;
  try {
    return ExpoSpeechRecognitionModule.supportsRecording() && ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export async function writeOutEnabled() {
  return writeOutSupported() && (await AsyncStorage.getItem(KEY).catch(() => null)) === 'on';
}

export async function setWriteOutEnabled(on: boolean) {
  if (on) {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) throw new Error('Allow the microphone and speech recognition to write out voice notes.');
  }
  await AsyncStorage.setItem(KEY, on ? 'on' : 'off');
}

export type WriteOutRecording = {
  /** Stops listening; resolves with the audio file and the words heard. */
  stop: () => Promise<{ uri: string; transcript: string }>;
  /** Throws the recording away. */
  cancel: () => void;
};

/** Starts a voice note that is written out as you speak. onWords gets the words so far. */
export async function startWriteOutRecording(onWords: (words: string) => void): Promise<WriteOutRecording> {
  const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!perm.granted) throw new Error('Allow the microphone and speech recognition to record.');
  const finals: string[] = [];
  let interim = '';
  let uri: string | null = null;
  let failure: string | null = null;
  let ended = false;
  let onEnd: () => void = () => undefined;
  const endedPromise = new Promise<void>(resolve => (onEnd = resolve));
  const subs = [
    ExpoSpeechRecognitionModule.addListener('result', e => {
      const t = e.results[0]?.transcript ?? '';
      if (e.isFinal) {
        finals.push(t);
        interim = '';
      } else interim = t;
      onWords(transcriptFrom(finals, interim));
    }),
    ExpoSpeechRecognitionModule.addListener('audioend', e => {
      uri = e.uri ?? uri;
    }),
    ExpoSpeechRecognitionModule.addListener('error', e => {
      // Silence isn't a failure: the voice note is kept without words.
      if (e.error !== 'no-speech' && e.error !== 'aborted') failure = e.message || 'Speech recognition stopped.';
    }),
    ExpoSpeechRecognitionModule.addListener('end', () => {
      ended = true;
      onEnd();
    }),
  ];
  const cleanup = () => subs.forEach(s => s.remove());
  const lang = getLocales()[0]?.languageTag || 'en-IN';
  try {
    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      continuous: true,
      addsPunctuation: true,
      recordingOptions: { persist: true, outputFileName: `voice-${Date.now()}.wav` },
    });
  } catch (e) {
    cleanup();
    throw e instanceof Error ? e : new Error('Could not start recording.');
  }
  return {
    async stop() {
      if (!ended) {
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch {
          // already stopped
        }
        // The file is complete once "end" arrives; don't wait forever if it never does.
        await Promise.race([endedPromise, new Promise(r => setTimeout(r, 8000))]);
      }
      cleanup();
      if (!uri) throw new Error(failure ?? 'The voice note could not be saved.');
      return { uri, transcript: transcriptFrom(finals, interim) };
    },
    cancel() {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // already stopped
      }
      cleanup();
    },
  };
}
