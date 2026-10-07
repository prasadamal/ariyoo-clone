import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { getBiometricLockEnabled, setBiometricLockEnabled } from '../lib/settings';
import { useAppTheme } from '../theme';
import { Icon } from '../ui/Icon';

type Ctx = { enabled: boolean; setEnabled: (v: boolean) => Promise<boolean> };

const AppLockContext = createContext<Ctx | null>(null);

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const [enabled, setEnabledState] = useState(false);
  const [unlocked, setUnlocked] = useState(true);
  const [checking, setChecking] = useState(true);

  /** Turning the lock on requires a successful biometric check first. */
  const setEnabled = useCallback(async (v: boolean) => {
    if (!v) {
      await setBiometricLockEnabled(false);
      setEnabledState(false);
      setUnlocked(true);
      return true;
    }
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) return false;
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Enable Wayfare lock' });
    if (!result.success) return false;
    await setBiometricLockEnabled(true);
    setEnabledState(true);
    setUnlocked(true);
    return true;
  }, []);

  const promptUnlock = useCallback(async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) {
      setUnlocked(true);
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Wayfare', cancelLabel: 'Cancel' });
    setUnlocked(result.success);
  }, []);

  useEffect(() => {
    getBiometricLockEnabled()
      .then(v => {
        setEnabledState(v);
        setUnlocked(!v);
        if (v) promptUnlock();
      })
      .finally(() => setChecking(false));
  }, [promptUnlock]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', s => {
      if (s === 'background') setUnlocked(false);
      if (s === 'active') promptUnlock();
    });
    return () => sub.remove();
  }, [enabled, promptUnlock]);

  let body = children;
  if (checking) {
    body = (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator />
      </View>
    );
  } else if (enabled && !unlocked) {
    body = (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.background }}>
        <Icon name="lock-outline" size={48} color={colors.primary} />
        <Text variant="headlineSmall" style={{ marginTop: 12, marginBottom: 8, fontWeight: '700' }}>
          Wayfare is locked
        </Text>
        <Text style={{ textAlign: 'center', color: colors.muted, marginBottom: 24 }}>
          Use your device biometrics to open your travel journal.
        </Text>
        <Button mode="contained" icon="fingerprint" onPress={promptUnlock}>
          Unlock
        </Button>
      </View>
    );
  }

  return <AppLockContext.Provider value={{ enabled, setEnabled }}>{body}</AppLockContext.Provider>;
}

export function useAppLock() {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock outside provider');
  return ctx;
}
