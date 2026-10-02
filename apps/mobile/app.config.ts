import { ExpoConfig, ConfigContext } from 'expo/config';

const BUNDLE_ID = 'com.ariyoo.mobile';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Ariyoo',
  slug: 'ariyoo',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'ariyoo',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0f172a',
  },
  ios: {
    bundleIdentifier: BUNDLE_ID,
    buildNumber: '1',
    supportsTablet: true,
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      NSCameraUsageDescription:
        'Ariyoo uses the camera so you can share photos in expert chat sessions.',
      NSPhotoLibraryUsageDescription:
        'Ariyoo accesses your photo library so you can attach images to questions and replies.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: BUNDLE_ID,
    versionCode: 1,
    permissions: ['INTERNET', 'CAMERA', 'READ_MEDIA_IMAGES'],
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0f172a',
    },
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.ariyoo.mobile',
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        photosPermission:
          'Allow Ariyoo to access your photos so you can share images in chat.',
        cameraPermission: 'Allow Ariyoo to use your camera to capture images for chat.',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 24,
          targetSdkVersion: 34,
          compileSdkVersion: 34,
          usesCleartextTraffic: process.env.EAS_BUILD_PROFILE !== 'production',
        },
        ios: {
          deploymentTarget: '13.4',
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? '00000000-0000-4000-8000-000000000000',
    },
  },
});
