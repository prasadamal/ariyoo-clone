import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, ScrollView, View } from 'react-native';
import { Button, Card, Dialog, Portal, SegmentedButtons, Switch, Text, TextInput, useTheme } from 'react-native-paper';
import { StatusBanner } from '../../src/components/StatusBanner';
import { APP_VERSION, DELETE_ACCOUNT_URL, isSupabaseConfigured, PRIVACY_URL, SUPPORT_EMAIL } from '../../src/config';
import { useAppLock } from '../../src/context/AppLockContext';
import { useAuth } from '../../src/context/AuthContext';
import { useSync } from '../../src/context/SyncContext';
import { useWayfareTheme, type ThemeMode } from '../../src/context/ThemeContext';
import { countPendingSync } from '../../src/lib/localDb';

export default function ProfileTab() {
  const theme = useTheme();
  const { user, profile, signOut, deleteAccount, updateDisplayName, guest, offlineMode } = useAuth();
  const { enabled: bioLock, setEnabled: setBioLock } = useAppLock();
  const { mode: themeMode, setMode: setThemeMode } = useWayfareTheme();
  const { syncNow, syncing, pending, lastSyncAt, lastError, offline } = useSync();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState('');

  const confirmSignOut = async () => {
    if (pending > 0) await syncNow();
    const left = await countPendingSync();
    Alert.alert(
      'Sign out?',
      left > 0
        ? `${left} change${left === 1 ? '' : 's'} could not be uploaded yet and will be lost if you sign out. Stay signed in and sync first?`
        : 'Your journeys are safely backed up. They are removed from this phone when you sign out and return when you sign back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: left > 0 ? 'Sign out anyway' : 'Sign out', style: 'destructive', onPress: () => signOut() },
      ]
    );
  };

  const runDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteAccount();
      setDeleteOpen(false);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete your account.');
    } finally {
      setDeleting(false);
    }
  };

  const saveName = async () => {
    try {
      await updateDisplayName(name);
      setNameOpen(false);
    } catch (e) {
      Alert.alert('Could not update name', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} style={{ backgroundColor: theme.colors.background }}>
      <Card style={{ marginTop: 4, padding: 12 }}>
        <Text variant="titleMedium">{user ? profile?.display_name ?? 'Traveler' : 'Guest traveler'}</Text>
        {user?.email ? <Text style={{ marginTop: 4, color: theme.colors.onSurfaceVariant }}>{user.email}</Text> : null}
        {!user ? (
          <Text style={{ marginTop: 4, color: theme.colors.onSurfaceVariant }}>
            {offlineMode ? 'Your journal is saved on this device.' : 'Not signed in — your journal is saved on this device only.'}
          </Text>
        ) : null}
        {user ? (
          <Button compact style={{ alignSelf: 'flex-start', marginTop: 8 }} onPress={() => { setName(profile?.display_name ?? ''); setNameOpen(true); }}>
            Edit display name
          </Button>
        ) : !offlineMode ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button mode="contained" onPress={() => router.push('/login')}>Sign in</Button>
            <Button mode="outlined" onPress={() => router.push('/register')}>Create account</Button>
          </View>
        ) : null}
      </Card>

      <Card style={{ marginTop: 12, padding: 12 }}>
        <Text variant="titleSmall">Appearance</Text>
        <SegmentedButtons
          value={themeMode}
          onValueChange={v => setThemeMode(v as ThemeMode)}
          buttons={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
          style={{ marginTop: 8 }}
        />
      </Card>

      <Card style={{ marginTop: 12, padding: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text variant="titleSmall">App lock</Text>
            <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>Require fingerprint, face or passcode to open Wayfare.</Text>
          </View>
          <Switch value={bioLock} onValueChange={v => setBioLock(v)} accessibilityLabel="App lock" />
        </View>
      </Card>

      {isSupabaseConfigured && user ? (
        <Card style={{ marginTop: 12, padding: 12 }}>
          <Text variant="titleSmall">Cloud backup</Text>
          <Text style={{ marginTop: 6, color: theme.colors.onSurfaceVariant }}>
            {offline ? 'Offline — waiting for a connection.' : pending > 0 ? `${pending} change${pending === 1 ? '' : 's'} waiting to upload.` : 'Everything is backed up.'}
          </Text>
          {lastSyncAt ? <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13, marginTop: 2 }}>Last synced {new Date(lastSyncAt).toLocaleString()}</Text> : null}
          {lastError ? <View style={{ marginTop: 8 }}><StatusBanner kind="error">{lastError}</StatusBanner></View> : null}
          <Button mode="contained" style={{ marginTop: 12 }} onPress={() => { syncNow(); }} loading={syncing} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync now'}
          </Button>
        </Card>
      ) : null}

      <Card style={{ marginTop: 12, padding: 4 }}>
        <Button mode="text" contentStyle={{ justifyContent: 'flex-start' }} onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy policy</Button>
        <Button mode="text" contentStyle={{ justifyContent: 'flex-start' }} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Wayfare%20support`)}>Contact support</Button>
      </Card>

      {user ? (
        <>
          <Button mode="outlined" style={{ marginTop: 16 }} onPress={confirmSignOut}>Sign out</Button>
          <Button mode="text" textColor={theme.colors.error} style={{ marginTop: 4 }} onPress={() => { setConfirmText(''); setDeleteError(''); setDeleteOpen(true); }}>
            Delete account
          </Button>
        </>
      ) : guest ? (
        <Button mode="text" style={{ marginTop: 16 }} onPress={() => Linking.openURL(DELETE_ACCOUNT_URL)}>How data deletion works</Button>
      ) : null}

      <Text style={{ marginTop: 24, color: theme.colors.onSurfaceVariant, fontSize: 12, textAlign: 'center' }}>Wayfare {APP_VERSION}</Text>

      <Portal>
        <Dialog visible={deleteOpen} onDismiss={() => !deleting && setDeleteOpen(false)}>
          <Dialog.Title>Delete account?</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 12 }}>
              This permanently erases your account and everything in your cloud backup — trips, entries, photos, voice notes, expenses and routes. It cannot be undone.
            </Text>
            <Text style={{ marginBottom: 8 }}>Type DELETE to confirm.</Text>
            <TextInput value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" mode="outlined" accessibilityLabel="Type DELETE to confirm" />
            {deleteError ? <Text style={{ color: theme.colors.error, marginTop: 8 }}>{deleteError}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
            <Button textColor={theme.colors.error} onPress={runDelete} disabled={confirmText.trim() !== 'DELETE' || deleting} loading={deleting}>Delete forever</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={nameOpen} onDismiss={() => setNameOpen(false)}>
          <Dialog.Title>Display name</Dialog.Title>
          <Dialog.Content>
            <TextInput value={name} onChangeText={setName} mode="outlined" maxLength={60} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setNameOpen(false)}>Cancel</Button>
            <Button onPress={saveName} disabled={!name.trim()}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}
