import { router } from 'expo-router';
import { getDiaryReminder, hourLabel, REMINDER_HOURS, setDiaryReminder, type DiaryReminder } from '../src/lib/diaryReminder';
import { setTelemetryEnabled, telemetryEnabled } from '../src/lib/telemetry';
import { ChipSelect } from '../src/ui/ChipSelect';
import { useEffect, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { Button, Dialog, Portal, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';
import { APP_VERSION, PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '../src/config';
import { useAppLock } from '../src/context/AppLockContext';
import { useAuth, useCanConnect } from '../src/context/AuthContext';
import { useSync } from '../src/context/SyncContext';
import { useWayfareTheme, type ThemeMode } from '../src/context/ThemeContext';
import { useToast } from '../src/context/ToastContext';
import { timeAgoPhrase } from '../src/lib/format';
import { stopDeviceActivity } from '../src/lib/deviceActivity';
import { wipeDevice } from '../src/lib/wipeDevice';
import { backupLabel, backupState, signOutMessage } from '../src/lib/backupStatus';
import { disablePush, enablePush, forgetPushToken, getPushPreference, type PushPreference } from '../src/lib/notifications';
import { setLocalOwner } from '../src/lib/sync';
import { deleteMyAccount, updateMyProfile } from '../src/social/profiles';
import { useAppTheme } from '../src/theme';
import { Icon } from '../src/ui/Icon';
import { Notice } from '../src/ui/Notice';
import { Screen } from '../src/ui/Screen';
import { SectionHeader } from '../src/ui/SectionHeader';
import { SOCIAL_ENABLED } from '../src/lib/features';
import { cleanUpiId, isValidUpiId } from '../src/lib/upi';
import { getUpiIds, MY_UPI, setUpiId } from '../src/lib/upiIds';
import { packingNudgesEnabled, setPackingNudgesEnabled } from '../src/lib/packingReminders';
import { setWriteOutEnabled, writeOutEnabled, writeOutSupported } from '../src/lib/voiceTranscribe';
import { journeysOnly } from '../src/lib/everydayMemories';
import { listTrips } from '../src/lib/localDb';

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
  const [reminder, setReminder] = useState<DiaryReminder>({ on: false, hour: 21 });
  const [myUpi, setMyUpi] = useState('');
  const [packNudges, setPackNudges] = useState(true);
  const voiceSupported = writeOutSupported();
  const [writeOut, setWriteOut] = useState(false);
  useEffect(() => {
    writeOutEnabled().then(setWriteOut).catch(() => undefined);
  }, []);
  useEffect(() => {
    packingNudgesEnabled().then(setPackNudges).catch(() => undefined);
  }, []);
  const [upiOpen, setUpiOpen] = useState(false);
  const [upiDraft, setUpiDraft] = useState('');
  useEffect(() => {
    getUpiIds().then(ids => setMyUpi(ids[MY_UPI] ?? '')).catch(() => undefined);
  }, []);
  const [telemetryOn, setTelemetryOn] = useState(true);
  useEffect(() => {
    getDiaryReminder().then(setReminder).catch(() => undefined);
    telemetryEnabled().then(setTelemetryOn).catch(() => undefined);
  }, []);
  const changeReminder = async (next: DiaryReminder) => {
    const before = reminder;
    setReminder(next);
    try {
      await setDiaryReminder(next);
      if (next.on) toast(`Reminder set for ${hourLabel(next.hour)} every day`);
    } catch (e) {
      setReminder(before);
      toast(e instanceof Error ? e.message : 'Could not set the reminder');
    }
  };
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

  const backup = { syncing, errors: lastErrors, pending, lastSyncAt };
  const backupVerified = backupState(backup) === 'verified';

  const signOutKeep = async () => {
    try { await forgetPushToken(); await signOut(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not sign out. Retry.'); }
  };

  // Removing journals is only offered once a backup is verified; otherwise "keep" is the safe choice
  // and "Sync first" lets the traveller verify before trying again.
  const confirmSignOut = () =>
    Alert.alert(
      'Sign out?',
      signOutMessage(backup),
      backupVerified
        ? [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out, keep journals here', onPress: signOutKeep },
            {
              text: 'Sign out & remove from phone',
              style: 'destructive',
              onPress: async () => {
                try { await forgetPushToken(); await signOut({ wipeLocal: true }); }
                catch (e) { toast(e instanceof Error ? e.message : 'Could not sign out and clear this device. Retry.'); }
              },
            },
          ]
        : [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sync first',
              onPress: async () => {
                const r = await syncNow();
                toast(r && !r.errors.length ? 'Backed up. You can sign out now.' : 'Backup didn’t finish. Your journals are still on this phone.');
              },
            },
            { text: 'Sign out, keep journals here', onPress: signOutKeep },
          ]
    );

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await forgetPushToken();
      await stopDeviceActivity();
      await deleteMyAccount();
      await wipeDevice();
      await setLocalOwner(null);
      setDeleteOpen(false);
      Alert.alert('Account deleted', 'Your Wayfare account, journals, posts and messages have been permanently deleted.');
      // Signing out rebuilds the screens; AuthRouteGuard then shows sign-in.
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete account — check your connection and try again.');
    } finally {
      setDeleting(false);
    }
  };

  const clearDeviceData = () =>
    Alert.alert('Remove journals from this phone?', backupVerified ? 'This deletes every trip, photo and voice note stored on this device. Your backup stays in your account.' : 'Your backup isn’t verified yet, so anything not synced will be lost for good. This deletes every trip, photo and voice note on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await stopDeviceActivity();
            await wipeDevice();
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
        body="Reminders, check-in timer alerts and crew updates."
        value={push === 'on'}
        onChange={togglePush}
        disabled={!canConnect}
      />

      {canConnect && profile && SOCIAL_ENABLED ? (
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
            {backupLabel(backup)}
            {lastSyncAt ? ` · last sync ${timeAgoPhrase(lastSyncAt)}` : ''}
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

      <SectionHeader title="Reminders" />
      <ToggleRow
        icon="notebook-edit-outline"
        title="Daily reminder"
        body={reminder.on ? `Every day at ${hourLabel(reminder.hour)}, a nudge to write today's page.` : 'A gentle nudge each evening to write today\'s page.'}
        value={reminder.on}
        onChange={on => changeReminder({ ...reminder, on })}
      />
      {reminder.on ? (
        <ChipSelect
          options={REMINDER_HOURS.map(h => ({ value: String(h), label: hourLabel(h) }))}
          value={String(reminder.hour)}
          onChange={h => changeReminder({ ...reminder, hour: Number(h) })}
        />
      ) : null}
      <ToggleRow
        icon="bag-checked"
        title="Packing reminders"
        body="3 days before a journey and the evening before: what's left to pack, with a tip from the forecast."
        value={packNudges}
        onChange={async on => {
          try {
            await setPackingNudgesEnabled(on, journeysOnly(await listTrips()));
            setPackNudges(on);
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Could not change packing reminders');
          }
        }}
      />

      {voiceSupported ? (
        <>
          <SectionHeader title="Voice notes" />
          <ToggleRow
            icon="text-to-speech"
            title="Write out voice notes (beta)"
            body="Your words appear as you speak and are saved with the moment, so you can read and search them. Uses your phone's speech recognition; voice notes are saved as larger .wav files."
            value={writeOut}
            onChange={async on => {
              try {
                await setWriteOutEnabled(on);
                setWriteOut(on);
              } catch (e) {
                toast(e instanceof Error ? e.message : 'Could not change this setting');
              }
            }}
          />
        </>
      ) : null}

      <SectionHeader title="Payments" />
      {/* Your UPI ID: used by "Request" in a journey's Settle up. Saved on this phone only. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="cellphone-arrow-down" size={22} color={colors.onSurfaceVariant} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600' }}>Your UPI ID</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{myUpi || 'Add it so friends can pay you back from a link.'}</Text>
        </View>
        <Button compact onPress={() => { setUpiDraft(myUpi); setUpiOpen(true); }}>{myUpi ? 'Change' : 'Add'}</Button>
      </View>
      <Portal>
        <Dialog visible={upiOpen} onDismiss={() => setUpiOpen(false)}>
          <Dialog.Title>Your UPI ID</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" label="UPI ID" placeholder="name@okaxis" value={upiDraft} onChangeText={setUpiDraft} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" error={!!upiDraft.trim() && !isValidUpiId(upiDraft)} />
          </Dialog.Content>
          <Dialog.Actions>
            {myUpi ? <Button textColor={colors.danger} onPress={async () => { await setUpiId(MY_UPI, null); setMyUpi(''); setUpiOpen(false); }}>Remove</Button> : null}
            <Button onPress={() => setUpiOpen(false)}>Cancel</Button>
            <Button mode="contained" disabled={!isValidUpiId(upiDraft)} onPress={async () => { const id = cleanUpiId(upiDraft); await setUpiId(MY_UPI, id); setMyUpi(id); setUpiOpen(false); }}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <SectionHeader title="Help us improve" />
      <ToggleRow
        icon="chart-box-outline"
        title="Share usage & crash reports"
        body="Anonymous counts (like “a moment was added”) and error reports. Never your words, photos or places."
        value={telemetryOn}
        onChange={async on => { setTelemetryOn(on); await setTelemetryEnabled(on); }}
      />
      <Button icon="message-text-outline" style={{ alignSelf: 'flex-start' }} onPress={() => router.push('/feedback' as never)}>
        Send feedback
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

      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 24, textAlign: 'center' }}>Wayfare {APP_VERSION} · com.wayfare.app</Text>

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

