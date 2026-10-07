import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_KEY = 'wayfare_guest_mode_v1';

/** "Use without an account": journal locally, sign up later to sync and connect. */
export async function isGuestMode() {
  return (await AsyncStorage.getItem(GUEST_KEY)) === '1';
}

export async function setGuestMode(on: boolean) {
  if (on) await AsyncStorage.setItem(GUEST_KEY, '1');
  else await AsyncStorage.removeItem(GUEST_KEY);
}
