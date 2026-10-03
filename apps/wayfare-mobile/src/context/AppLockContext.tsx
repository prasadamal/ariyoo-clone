import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { getBiometricLockEnabled, setBiometricLockEnabled } from '../lib/settings';
import { useWayfareTheme } from './ThemeContext';

type Ctx = { enabled: boolean; setEnabled: (v: boolean) => Promise<void> };

const AppLockContext = createContext<Ctx | null>(null);

async function canAuthenticate() {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  return level !== LocalAuthentication.SecurityLevel.NONE;
}

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const { paperTheme } = useWayfareTheme();
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const prompting = useRef(false);
  const enabledRef = useRef(false);
  const lockedRef = useRef(false);
  enabledRef.current = enabled;
  lockedRef.current = locked;

  const promptUnlock = useCallback(async () => {
    if (prompting.current) return; // the system dialog itself toggles AppState; don't re-enter
    prompting.current = true;
    try {
      if (!(await canAuthenticate())) {
        setLocked(false); // user removed all device security; don't lock them out of their own journal
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Wayfare',
        cancelLabel: 'Cancel',
      });
      if (result.success) setLocked(false);
    } finally {
      // Let the AppState event caused by the dialog closing pass before allowing another prompt.
      setTimeout(() => {
        prompting.current = false;
      }, 600);
    }
  }, []);

  const setEnabled = useCallback(
    async (v: boolean) => {
      if (v) {
        if (!(await canAuthenticate())) {
          Alert.alert('Set up a screen lock', 'Add a fingerprint, face or passcode in your device settings first.');
          return;
        }
        prompting.current = true;
        const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Turn on the Wayfare lock' });
        setTimeout(() => {
          prompting.current = false;
        }, 600);
        if (!result.success) return;
      }
      await setBiometricLockEnabled(v);
      setEnabledState(v);
      setLocked(false);
    },
    []
  );

  // Cold start: if the lock is on, start locked (not unlocked) and prompt immediately.
  useEffect(() => {
    getBiometricLockEnabled()
      .then(v => {
        setEnabledState(v);
        if (v) {
          setLocked(true);
          promptUnlock();
        }
      })
      .finally(() => setReady(true));
  }, [promptUnlock]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (!enabledRef.current) return;
      if (state === 'background') setLocked(true);
      if (state === 'active' && lockedRef.current) promptUnlock();
    });
    return () => sub.remove();
  }, [promptUnlock]);

  const value = useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);

  return (
    <AppLockContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {ready ? children : null}
        {!ready || (enabled && locked) ? (
          <View
            style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: paperTheme.colors.background }]}
            accessibilityViewIsModal
          >
            {!ready ? (
              <ActivityIndicator />
            ) : (
              <>
                <Text variant="headlineSmall" style={{ marginBottom: 8 }}>
                  Wayfare is locked
                </Text>
                <Text style={{ textAlign: 'center', color: paperTheme.colors.onSurfaceVariant, marginBottom: 24 }}>
                  Use your fingerprint, face or passcode to open your travel journal.
                </Text>
                <Button mode="contained" onPress={promptUnlock} accessibilityLabel="Unlock Wayfare">
                  Unlock
                </Button>
              </>
            )}
          </View>
        ) : null}
      </View>
    </AppLockContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: { justifyContent: 'center', alignItems: 'center', padding: 24, zIndex: 1000, elevation: 1000 },
});

export function useAppLock() {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock outside provider');
  return ctx;
}
