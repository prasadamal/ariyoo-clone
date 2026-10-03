import { ConfigContext, ExpoConfig } from 'expo/config';
import { ConfigPlugin, withInfoPlist } from 'expo/config-plugins';

const BUNDLE_ID = 'com.wayfare.app';
const BG = '#1c1917';
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
// Written by `eas init`; export EAS_PROJECT_ID for CI. Omitted when unknown so EAS prompts instead of failing obscurely.
const easProjectId = process.env.EAS_PROJECT_ID;

/**
 * Library plugins add iOS background modes / strings the app never uses
 * (audio, fetch, motion). Apple flags unused background modes (guideline 2.5.4),
 * so keep exactly what Wayfare needs: location, for route recording.
 */
const withMinimalIosCapabilities: ConfigPlugin = c =>
  withInfoPlist(c, cfg => {
    cfg.modResults.UIBackgroundModes = ['location'];
    delete cfg.modResults.NSMotionUsageDescription;
    return cfg;
  });

export default ({ config }: ConfigContext): ExpoConfig =>
  withMinimalIosCapabilities({
  ...config,
  name: 'Wayfare',
  slug: 'wayfare',
  version: '1.3.0',
  platforms: ['ios', 'android'],
  orientation: 'portrait',
  scheme: 'wayfare',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
    config: {
      ...(googleMapsApiKey ? { googleMapsApiKey } : {}),
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    // Apple "required reason" API declarations for the app target.
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1', '0A2A.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'] },
      ],
    },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: BG,
    },
    permissions: [
      'INTERNET',
      'ACCESS_NETWORK_STATE',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'RECORD_AUDIO',
      'VIBRATE',
    ],
    // Photos use the system photo picker, so no storage/media or camera permissions are needed.
    // Blocking them keeps the Play "permissions declaration" form short.
    blockedPermissions: [
      'android.permission.CAMERA',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
    ],
    config: {
      ...(googleMapsApiKey ? { googleMaps: { apiKey: googleMapsApiKey } } : {}),
    },
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: BG,
        image: './assets/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
      },
    ],
    'expo-secure-store',
    'expo-sqlite',
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Wayfare uses your location while you record a trip route and, if you choose, to attach local weather to journal entries.',
        // Never requested: the app only needs "While Using". Strings are kept because the iOS binary links the API.
        locationAlwaysAndWhenInUsePermission: 'Wayfare records your route during a trip you have started.',
        locationAlwaysPermission: 'Wayfare records your route during a trip you have started.',
        isIosBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        isAndroidBackgroundLocationEnabled: false,
        motionUsagePermission: false,
        androidForegroundServiceIcon: './assets/notification-icon.png',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Wayfare lets you attach photos from your library to journal entries.',
        cameraPermission: false,
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission: 'Wayfare records short voice notes for your travel journal.',
        recordAudioAndroid: true,
        enableBackgroundRecording: false,
        enableBackgroundPlayback: false,
      },
    ],
    ['expo-local-authentication', { faceIDPermission: 'Wayfare uses Face ID to unlock your private journal.' }],
    [
      'expo-build-properties',
      {
        android: {
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          usesCleartextTraffic: false,
        },
      },
    ],
  ],
  extra: {
    ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    googleMapsApiKey,
  },
  } as ExpoConfig);
