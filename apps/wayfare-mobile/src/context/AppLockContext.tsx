import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { getBiometricLockEnabled, setBiometricLockEnabled } from '../lib/settings';

type Ctx = { enabled: boolean; setEnabled: (v: boolean) => Promise<void> };

const AppLockContext = createContext<Ctx | null>(null);

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [unlocked, setUnlocked] = useState(true);
  const [checking, setChecking] = useState(true);

  const setEnabled = useCallback(async (v: boolean) => {
    await setBiometricLockEnabled(v);
    setEnabledState(v);
    if (!v) setUnlocked(true);
    else {
      setUnlocked(false);
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Enable Wayfare lock' });
      setUnlocked(result.success);
    }
  }, []);

  const promptUnlock = useCallback(async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) {
      setUnlocked(true);
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Wayfare',
      cancelLabel: 'Cancel',
    });
    setUnlocked(result.success);
  }, []);

  useEffect(() => {
    getBiometricLockEnabled().then(v => {
      setEnabledState(v);
      if (!v) setUnlocked(true);
    }).finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', s => {
      if (s === 'background') setUnlocked(false);
      if (s === 'active') promptUnlock();
    });
    return () => sub.remove();
  }, [enabled, promptUnlock]);

  const value = { enabled, setEnabled };

  let body = children;
  if (checking) {
    body = (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  } else if (enabled && !unlocked) {
    body = (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fafaf9' }}>
        <Text variant="headlineSmall" style={{ marginBottom: 8 }}>Wayfare is locked</Text>
        <Text style={{ textAlign: 'center', color: '#57534e', marginBottom: 24 }}>
          Use your device biometrics to open your travel journal.
        </Text>
        <Button mode="contained" onPress={promptUnlock}>Unlock</Button>
      </View>
    );
  }

  return <AppLockContext.Provider value={value}>{body}</AppLockContext.Provider>;
}

export function useAppLock() {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock outside provider');
  return ctx;
}
