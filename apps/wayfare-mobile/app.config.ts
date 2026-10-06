import fs from 'node:fs';
import path from 'node:path';
import { ExpoConfig, ConfigContext } from 'expo/config';

const BUNDLE_ID = 'com.wayfare.app';
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
// Android push (FCM): google-services.json from the Firebase console, saved next to this file or
// uploaded as the EAS file variable GOOGLE_SERVICES_JSON.
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ??
  (fs.existsSync(path.join(__dirname, 'google-services.json')) ? './google-services.json' : undefined);
// The project id `eas init` prints for this app. EAS builds and remote push need it, and EAS CLI
// does not read .env files, so paste it here (or export EAS_PROJECT_ID before every eas command).
const easProjectId = process.env.EAS_PROJECT_ID || '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Wayfare',
  slug: 'wayfare',
  version: '2.0.0',
  orientation: 'portrait',
  scheme: 'wayfare',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#1c1917',
  },
  ios: {
    bundleIdentifier: BUNDLE_ID,
    buildNumber: '4',
    supportsTablet: true,
    config: {
      usesNonExemptEncryption: false,
      ...(googleMapsApiKey ? { googleMapsApiKey } : {}),
    },
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Wayfare uses your location to geotag journal moments, record your route, show nearby travellers you choose to meet and share live location with people you trust.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Wayfare keeps recording your trip route and your live-location link in the background, only while you have started them.',
      NSPhotoLibraryUsageDescription: 'Add photos to your travel journal, posts and chats.',
      NSCameraUsageDescription: 'Capture photos for your journal, posts and chats.',
      NSMicrophoneUsageDescription: 'Record short voice notes in your travel journal.',
      NSFaceIDUsageDescription: 'Lock your private travel journal with Face ID.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: BUNDLE_ID,
    versionCode: 4,
    ...(googleServicesFile ? { googleServicesFile } : {}),
    permissions: [
      'INTERNET',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'READ_MEDIA_IMAGES',
      'CAMERA',
      'RECORD_AUDIO',
      'POST_NOTIFICATIONS',
      'VIBRATE',
      'USE_BIOMETRIC',
    ],
    config: {
      ...(googleMapsApiKey ? { googleMaps: { apiKey: googleMapsApiKey } } : {}),
    },
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1c1917',
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-localization',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Allow Wayfare to keep recording your route and live location while you have them switched on.',
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        isIosBackgroundLocationEnabled: true,
      },
    ],
    [
      'expo-notifications',
      {
        color: '#c2410c',
      },
    ],
    [
      'expo-build-properties',
      {
        android: { minSdkVersion: 24, targetSdkVersion: 34, compileSdkVersion: 34 },
        ios: { deploymentTarget: '13.4' },
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    googleMapsApiKey,
  },
});
