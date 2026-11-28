import fs from 'node:fs';
import path from 'node:path';
import { ExpoConfig, ConfigContext } from 'expo/config';
import { ConfigPlugin, withInfoPlist } from 'expo/config-plugins';

const BUNDLE_ID = 'com.wayfare.app';
const BG = '#ffffff';
// Android push (FCM): google-services.json from the Firebase console, saved next to this file or
// uploaded as the EAS file variable GOOGLE_SERVICES_JSON.
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ??
  (fs.existsSync(path.join(__dirname, 'google-services.json')) ? './google-services.json' : undefined);
// The project id `eas init` prints for this app. EAS builds and remote push need it, and EAS CLI
// does not read .env files, so paste it here (or export EAS_PROJECT_ID before every eas command).
const easProjectId = process.env.EAS_PROJECT_ID || 'ec83155f-8a41-45ac-9f51-0c0a96a320ca';

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
    owner: 'prasadaamals-team',
    version: '2.0.0',
    // 'web' is for the local browser preview only (npm run web); the app itself ships to ios and android.
    platforms: ['ios', 'android', 'web'],
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
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Wayfare uses your location to tag journal moments with where you were, record the route of a journey you start, and share your live location with people you choose.',
        // Never requested ("While using" is enough), but iOS requires the strings because the binary links the API.
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Wayfare records a journey route or a live-location link only after you start it, and stops when you stop it.',
        NSLocationAlwaysUsageDescription:
          'Wayfare records a journey route or a live-location link only after you start it, and stops when you stop it.',
        // The plugins below set these too; every copy says the same, so the order never matters.
        NSPhotoLibraryUsageDescription: 'Wayfare uses the photos you choose so you can add them to journal moments and trip covers. Photos stay on your phone unless you add them.',
        NSCameraUsageDescription: 'Wayfare uses the camera to take photos for your journal moments and trip covers.',
        NSMicrophoneUsageDescription: 'Wayfare records voice notes for your journal when you tap the microphone.',
        NSFaceIDUsageDescription: 'Wayfare uses Face ID to lock your private travel journal, if you switch the lock on.',
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
      // background-location permission. Photos are chosen with the system photo picker, which needs
      // no storage or media permission, so Play's photo-permission declaration doesn't apply.
      // ("Add photos from these dates" read the gallery by date; it is off for the first release.)
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
          // White behind the logo, matching the icon, so only the mark shows.
          image: './assets/icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: BG,
        },
      ],
      'expo-secure-store',
      'expo-sqlite',
      // Maps: MapLibre with free OpenStreetMap tiles (OpenFreeMap). No Google Maps key needed.
      '@maplibre/maplibre-react-native',
      'expo-localization',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Wayfare uses your location to tag journal moments with where you were, record the route of a journey you start, and share your live location with people you choose.',
          locationAlwaysAndWhenInUsePermission:
            'Wayfare records a journey route or a live-location link only after you start it, and stops when you stop it.',
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
          photosPermission: 'Wayfare uses the photos you choose so you can add them to journal moments and trip covers. Photos stay on your phone unless you add them.',
          cameraPermission: 'Wayfare uses the camera to take photos for your journal moments and trip covers.',
          // Must not be `false`: that would also strip RECORD_AUDIO, which voice notes need.
          microphonePermission: 'Wayfare records voice notes for your journal when you tap the microphone.',
        },
      ],
      [
        'expo-audio',
        {
          microphonePermission: 'Wayfare records voice notes for your journal when you tap the microphone.',
          recordAudioAndroid: true,
          enableBackgroundRecording: false,
          enableBackgroundPlayback: false,
        },
      ],
      ['expo-local-authentication', { faceIDPermission: 'Wayfare uses Face ID to lock your private travel journal, if you switch the lock on.' }],
    ],
    experiments: { typedRoutes: true },
    extra: {
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    },
  });
