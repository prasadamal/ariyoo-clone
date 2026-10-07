import fs from 'node:fs';
import path from 'node:path';
import { ExpoConfig, ConfigContext } from 'expo/config';
import { ConfigPlugin, withInfoPlist } from 'expo/config-plugins';

const BUNDLE_ID = 'com.wayfare.app';
const BG = '#1c1917';
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
// Android push (FCM): google-services.json from the Firebase console, saved next to this file or
// uploaded as the EAS file variable GOOGLE_SERVICES_JSON.
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ??
  (fs.existsSync(path.join(__dirname, 'google-services.json')) ? './google-services.json' : undefined);
// The project id `eas init` prints for this app. EAS builds and remote push need it, and EAS CLI
// does not read .env files, so paste it here (or export EAS_PROJECT_ID before every eas command).
const easProjectId = process.env.EAS_PROJECT_ID || '';

/**
 * Apple rejects background modes an app does not use (guideline 2.5.4). Wayfare needs exactly one:
 * location, for route recording and live-location links the traveller starts.
 */
const withOnlyLocationBackgroundMode: ConfigPlugin = c =>
  withInfoPlist(c, cfg => {
    cfg.modResults.UIBackgroundModes = ['location'];
    return cfg;
  });

export default ({ config }: ConfigContext): ExpoConfig =>
  withOnlyLocationBackgroundMode({
    ...config,
    name: 'Wayfare',
    slug: 'wayfare',
    version: '2.0.0',
    platforms: ['ios', 'android'],
    orientation: 'portrait',
    scheme: 'wayfare',
    userInterfaceStyle: 'automatic',
    icon: './assets/icon.png',
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
        // Never requested ("While using" is enough), but iOS requires the strings because the binary links the API.
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Wayfare records your trip route and live-location link only while you have started them.',
        NSLocationAlwaysUsageDescription:
          'Wayfare records your trip route and live-location link only while you have started them.',
        NSPhotoLibraryUsageDescription: 'Add photos to your travel journal, posts and chats.',
        NSCameraUsageDescription: 'Capture photos for your journal, posts and chats.',
        NSMicrophoneUsageDescription: 'Record short voice notes in your travel journal.',
        NSFaceIDUsageDescription: 'Lock your private travel journal with Face ID.',
        ITSAppUsesNonExemptEncryption: false,
      },
      // "Required reason" API declarations, merged from the PrivacyInfo.xcprivacy files of React Native
      // and the native libraries in node_modules (Apple does not reliably read static pods' own files).
      privacyManifests: {
        NSPrivacyAccessedAPITypes: [
          { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1', '1C8F.1'] },
          { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1', '0A2A.1', '3B52.1'] },
          { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
          { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'] },
        ],
      },
    },
    android: {
      package: BUNDLE_ID,
      versionCode: 4,
      ...(googleServicesFile ? { googleServicesFile } : {}),
      permissions: [
        'INTERNET',
        'ACCESS_NETWORK_STATE',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'CAMERA',
        'RECORD_AUDIO',
        'POST_NOTIFICATIONS',
        'VIBRATE',
        'USE_BIOMETRIC',
      ],
      // Route recording runs as a foreground service started from the app, which needs no
      // background-location permission; photos come from the system photo picker, which needs no
      // storage/media permission. Blocking them keeps Play's permission declarations short.
      blockedPermissions: [
        'android.permission.ACCESS_BACKGROUND_LOCATION',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.READ_MEDIA_AUDIO',
        'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ],
      config: {
        ...(googleMapsApiKey ? { googleMaps: { apiKey: googleMapsApiKey } } : {}),
      },
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: BG,
      },
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          // The icon has the same background colour, so only the mark shows.
          image: './assets/icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: BG,
        },
      ],
      'expo-secure-store',
      'expo-sqlite',
      'expo-localization',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Wayfare uses your location to geotag journal moments, record your route, show nearby travellers you choose to meet and share live location with people you trust.',
          locationAlwaysAndWhenInUsePermission:
            'Wayfare records your trip route and live-location link only while you have started them.',
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: false,
          isAndroidForegroundServiceEnabled: true,
          androidForegroundServiceIcon: './assets/notification-icon.png',
          // expo-location links CoreMotion, so iOS needs the string even though Wayfare never asks.
          motionUsagePermission: 'Wayfare never reads motion or fitness activity; route recording uses location only.',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#c2410c',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Add photos to your travel journal, posts and chats.',
          cameraPermission: 'Capture photos for your journal, posts and chats.',
          // Must not be `false`: that would also strip RECORD_AUDIO, which voice notes need.
          microphonePermission: 'Record short voice notes in your travel journal.',
        },
      ],
      [
        'expo-audio',
        {
          microphonePermission: 'Record short voice notes in your travel journal.',
          recordAudioAndroid: true,
          enableBackgroundRecording: false,
          enableBackgroundPlayback: false,
        },
      ],
      ['expo-local-authentication', { faceIDPermission: 'Lock your private travel journal with Face ID.' }],
    ],
    experiments: { typedRoutes: true },
    extra: {
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
      googleMapsApiKey,
    },
  });
