import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'wayfare_onboarding_done_v1';

export async function isOnboardingComplete() {
  return (await AsyncStorage.getItem(KEY)) === '1';
}

export async function completeOnboarding() {
  await AsyncStorage.setItem(KEY, '1');
}
