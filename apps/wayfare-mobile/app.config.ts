import { ExpoConfig, ConfigContext } from 'expo/config';

const BUNDLE_ID = 'com.wayfare.app';
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Wayfare',
  slug: 'wayfare',
  version: '1.2.0',
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
    buildNumber: '3',
    supportsTablet: true,
    config: {
      usesNonExemptEncryption: false,
      ...(googleMapsApiKey ? { googleMapsApiKey } : {}),
    },
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Wayfare records your route while you journal a trip so your journey is verifiable.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Wayfare can record GPS breadcrumbs in the background during an active trip recording session.',
      NSPhotoLibraryUsageDescription: 'Add photos to your travel journal entries.',
      NSCameraUsageDescription: 'Capture photos for your journal.',
      NSMicrophoneUsageDescription: 'Record short voice notes in your travel journal.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: BUNDLE_ID,
    versionCode: 3,
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
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Allow Wayfare to record your route during an active trip.',
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
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
    eas: { projectId: process.env.EAS_PROJECT_ID ?? '00000000-0000-4000-8000-000000000001' },
    googleMapsApiKey,
  },
});
