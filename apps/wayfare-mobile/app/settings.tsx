import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { Button, Dialog, Portal, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';
import { APP_VERSION, PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '../src/config';
import { useAppLock } from '../src/context/AppLockContext';
import { useAuth, useCanConnect } from '../src/context/AuthContext';
import { useSync } from '../src/context/SyncContext';
import { useWayfareTheme, type ThemeMode } from '../src/context/ThemeContext';
import { useToast } from '../src/context/ToastContext';
import { timeAgo } from '../src/lib/format';
import { stopDeviceActivity } from '../src/lib/deviceActivity';
import { wipeLocalData } from '../src/lib/localDb';
import { disablePush, enablePush, forgetPushToken, getPushPreference, type PushPreference } from '../src/lib/notifications';
import { setLocalOwner } from '../src/lib/sync';
import { deleteMyAccount, updateMyProfile } from '../src/social/profiles';
import { useAppTheme } from '../src/theme';
import { Icon } from '../src/ui/Icon';
import { Notice } from '../src/ui/Notice';
import { Screen } from '../src/ui/Screen';
import { SectionHeader } from '../src/ui/SectionHeader';

function ToggleRow({ icon, title, body, value, onChange, disabled }: { icon: string; title: string; body: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <Icon name={icon} size={22} color={colors.onSurfaceVariant} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600' }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>{body}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} />
    </View>
  );
}

export default function SettingsScreen() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const { user, profile, offlineMode, guest, signOut, refreshProfile } = useAuth();
  const canConnect = useCanConnect();
  const { mode, setMode } = useWayfareTheme();
  const { enabled: lockEnabled, setEnabled: setLock } = useAppLock();
  const { syncing, syncNow, pending, lastSyncAt, lastErrors } = useSync();
  const [push, setPush] = useState<PushPreference>('unset');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getPushPreference().then(setPush);
  }, []);

  const updatePrivacy = async (patch: Parameters<typeof updateMyProfile>[0]) => {
    try {
      await updateMyProfile(patch);
      await refreshProfile();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save');
    }
  };

  const togglePush = async (on: boolean) => {
    if (on) {
      const r = await enablePush().catch(e => ({ ok: false, message: e instanceof Error ? e.message : 'Could not enable' }));
      toast(r.message);
      setPush(r.ok ? 'on' : 'off');
    } else {
      await disablePush();
      setPush('off');
    }
  };

  const toggleLock = async (on: boolean) => {
    const ok = await setLock(on);
    if (on && !ok) toast('Set up Face ID / fingerprint on this device first.');
  };

  const confirmSignOut = () =>
    Alert.alert('Sign out?', pending ? `${pending} change${pending === 1 ? ' has' : 's have'} not synced yet and will stay on this phone.` : 'Your journals are backed up to your account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out, keep journals here',
        onPress: async () => {
          try { await forgetPushToken(); await signOut(); }
          catch (e) { toast(e instanceof Error ? e.message : 'Could not sign out. Retry.'); }
        },
      },
      {
        text: 'Sign out & remove from phone',
        style: 'destructive',
        onPress: async () => {
          try { await forgetPushToken(); await signOut({ wipeLocal: true }); }
          catch (e) { toast(e instanceof Error ? e.message : 'Could not sign out and clear this device. Retry.'); }
        },
      },
    ]);

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await forgetPushToken();
      await stopDeviceActivity();
      await deleteMyAccount();
      await wipeLocalData();
      await setLocalOwner(null);
      setDeleteOpen(false);
      Alert.alert('Account deleted', 'Your Wayfare account, journals, posts and messages have been permanently deleted.');
      router.replace('/login');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete account — check your connection and try again.');
    } finally {
      setDeleting(false);
    }
  };

  const clearDeviceData = () =>
    Alert.alert('Remove journals from this phone?', 'This deletes every trip, photo and voice note stored on this device. Synced data stays in your account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await stopDeviceActivity();
            await wipeLocalData();
            toast('Removed from this phone');
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Could not remove this device’s journals. Retry.');
          }
        },
      },
    ]);

  return (
    <Screen>
      <SectionHeader title="Appearance" style={{ marginTop: 0 }} />
      <SegmentedButtons
        value={mode}
        onValueChange={v => setMode(v as ThemeMode)}
        buttons={[
          { value: 'system', label: 'Auto', icon: 'theme-light-dark' },
          { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
          { value: 'dark', label: 'Dark', icon: 'weather-night' },
        ]}
      />

      <SectionHeader title="Security" />
      <ToggleRow icon="fingerprint" title="App lock" body="Require Face ID / fingerprint to open your journal." value={lockEnabled} onChange={toggleLock} />
      <ToggleRow
        icon="bell-outline"
        title="Push notifications"
        body="Messages, join requests, follows and travellers on your dates."
        value={push === 'on'}
        onChange={togglePush}
        disabled={!canConnect}
      />

      {canConnect && profile ? (
        <>
          <SectionHeader title="Privacy" />
          <ToggleRow
            icon="account-search-outline"
            title="Discoverable"
            body="Appear in search, suggestions, nearby and trip matches. Turning this off hides you from people who do not follow you."
            value={profile.is_discoverable}
            onChange={v => updatePrivacy({ is_discoverable: v })}
          />
          <Text style={{ fontWeight: '600', marginTop: 8, marginBottom: 6 }}>Who can message you</Text>
          <SegmentedButtons
            value={profile.allow_messages}
            onValueChange={v => updatePrivacy({ allow_messages: v as 'everyone' | 'following' | 'none' })}
            buttons={[
              { value: 'everyone', label: 'Everyone' },
              { value: 'following', label: 'People I follow' },
              { value: 'none', label: 'Nobody' },
            ]}
          />
          <Button icon="account-cancel-outline" style={{ alignSelf: 'flex-start', marginTop: 10 }} onPress={() => router.push('/blocked')}>
            Blocked travellers
          </Button>
          <Button icon="shield-check-outline" style={{ alignSelf: 'flex-start' }} onPress={() => router.push('/guidelines')}>
            Community guidelines
          </Button>
        </>
      ) : null}

      <SectionHeader title="Backup & sync" />
      {offlineMode ? (
        <Notice tone="info" text="This build runs in offline journal mode (cloud not configured). Everything stays on this phone." />
      ) : guest || !user ? (
        <>
          <Notice tone="warning" text="Your journal lives only on this phone. Create a free account to back it up and use it on other devices." />
          <Button mode="contained" onPress={() => router.push('/register')}>
            Create account
          </Button>
        </>
      ) : (
        <>
          <Text style={{ color: colors.onSurfaceVariant }}>
            {syncing ? 'Syncing…' : lastErrors.length ? 'Backup needs attention — try syncing again' : pending ? `${pending} change${pending === 1 ? '' : 's'} waiting to sync` : lastSyncAt ? 'Everything is backed up' : 'Backup has not been verified yet'}
            {lastSyncAt ? ` · last sync ${timeAgo(lastSyncAt)} ago` : ''}
          </Text>
          {lastErrors.length ? <Notice tone="error" text={lastErrors.slice(0, 2).join(' · ')} /> : null}
          <Button mode="outlined" icon="cloud-sync-outline" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => syncNow()} loading={syncing} disabled={syncing}>
            Sync now
          </Button>
        </>
      )}
      <Button icon="cellphone-remove" textColor={colors.muted} style={{ alignSelf: 'flex-start', marginTop: 4 }} onPress={clearDeviceData}>
        Remove journals from this phone
      </Button>

      <SectionHeader title="About" />
      <Button icon="file-document-outline" style={{ alignSelf: 'flex-start' }} onPress={() => Linking.openURL(PRIVACY_URL)}>
        Privacy policy
      </Button>
      <Button icon="scale-balance" style={{ alignSelf: 'flex-start' }} onPress={() => Linking.openURL(TERMS_URL)}>
        Terms of use
      </Button>
      <Button icon="email-outline" style={{ alignSelf: 'flex-start' }} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Wayfare%20support`)}>
        Contact support
      </Button>

      {user ? (
        <>
          <SectionHeader title="Account" />
          <Text style={{ color: colors.muted }}>{user.email}</Text>
          <Button mode="outlined" icon="logout" style={{ marginTop: 10 }} onPress={confirmSignOut}>
            Sign out
          </Button>
          <Button textColor={colors.error} icon="account-remove-outline" style={{ marginTop: 6 }} onPress={() => setDeleteOpen(true)}>
            Delete account
          </Button>
        </>
      ) : null}

      <Text style={{ color: colors.subtle, fontSize: 12, marginTop: 24, textAlign: 'center' }}>Wayfare {APP_VERSION} · com.wayfare.app</Text>

      <Portal>
        <Dialog visible={deleteOpen} onDismiss={() => !deleting && setDeleteOpen(false)}>
          <Dialog.Title>Delete your account?</Dialog.Title>
          <Dialog.Content>
            <Text style={{ lineHeight: 21 }}>
              This permanently deletes your account, cloud journals, photos, posts, comments, messages and board posts. It cannot be undone.
            </Text>
            <TextInput mode="outlined" label='Type "DELETE" to confirm' value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" style={{ marginTop: 12 }} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button mode="contained" buttonColor={colors.error} onPress={deleteAccount} loading={deleting} disabled={confirmText.trim() !== 'DELETE' || deleting}>
              Delete forever
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

