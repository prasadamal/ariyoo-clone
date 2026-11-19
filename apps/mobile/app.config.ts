import fs from 'node:fs';
import path from 'node:path';
import { ExpoConfig, ConfigContext } from 'expo/config';

const BUNDLE_ID = 'com.ariyoo.mobile';
const BG = '#0F1513';
// The project id `eas init` prints for this app. EAS builds and push notifications need it, and
// EAS CLI does not read .env files, so paste it here (or export EAS_PROJECT_ID before eas commands).
const easProjectId = process.env.EAS_PROJECT_ID || '543993a6-58b8-48ea-95e5-428693707d81';
// Android push (FCM): google-services.json from the Firebase console, saved next to this file or
// uploaded as the EAS file variable GOOGLE_SERVICES_JSON.
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ??
  (fs.existsSync(path.join(__dirname, 'google-services.json')) ? './google-services.json' : undefined);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Ariyoo',
  slug: 'ariyoo',
  owner: 'prasadaamals-team',
  version: '1.0.0',
  platforms: ['ios', 'android'],
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'ariyoo',
  userInterfaceStyle: 'automatic',
  backgroundColor: BG,
  ios: {
    bundleIdentifier: BUNDLE_ID,
    buildNumber: '1',
    supportsTablet: true,
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      // Photos are chosen in the system picker, which shows this text only on older iOS versions.
      NSPhotoLibraryUsageDescription: 'Choose a photo to send in a conversation.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: BUNDLE_ID,
    versionCode: 1,
    ...(googleServicesFile ? { googleServicesFile } : {}),
    permissions: ['INTERNET', 'POST_NOTIFICATIONS', 'VIBRATE'],
    // The system photo picker needs no media permission, and the app never uses the camera or
    // microphone. Blocking them keeps Play's permission declarations (and review) short.
    blockedPermissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: BG,
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-splash-screen', { image: './assets/icon.png', imageWidth: 200, resizeMode: 'contain', backgroundColor: BG }],
    ['expo-notifications', { color: '#38bdf8' }],
    [
      'expo-image-picker',
      {
        photosPermission: 'Choose a photo to send in a conversation.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
  },
});
