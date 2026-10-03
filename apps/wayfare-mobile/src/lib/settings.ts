import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_KEY = 'wayfare_biometric_lock';

export async function getBiometricLockEnabled() {
  return (await AsyncStorage.getItem(BIOMETRIC_KEY)) === '1';
}

export async function setBiometricLockEnabled(enabled: boolean) {
  await AsyncStorage.setItem(BIOMETRIC_KEY, enabled ? '1' : '0');
}
