import * as Localization from 'expo-localization';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, Share, View } from 'react-native';
import { Button, IconButton, Text, TextInput } from 'react-native-paper';
import { getDestination } from '../src/content/destinations';
import { ALTITUDE_GUIDE, EMERGENCY_NUMBERS, MEETUP_SAFETY, TREK_CHECKLIST, emergencyNumbersFor } from '../src/content/safety';
import { useAuth, useCanConnect } from '../src/context/AuthContext';
import { useToast } from '../src/context/ToastContext';
import { listTrips } from '../src/lib/localDb';
import { buildLiveShareUrls } from '../src/lib/liveShare';
import { getActiveTrackingTripId, getLiveShareState, startLiveSharing, stopLiveSharing } from '../src/lib/locationTask';
import type { LiveShareState } from '../src/lib/locationState';
import {
  addContact,
  callNumber,
  cancelCheckIn,
  getCheckIn,
  getContacts,
  getSosName,
  removeContact,
  sendSms,
  setSosName,
  startCheckIn,
  type CheckIn,
  type EmergencyContact,
} from '../src/lib/safety';
import { buildCheckInMessage, buildSosMessage } from '../src/lib/sosMessage';
import { tripPhase } from '../src/lib/format';
import { useAppTheme } from '../src/theme';
import { Icon } from '../src/ui/Icon';
import { Notice } from '../src/ui/Notice';
import { Pill } from '../src/ui/Pill';
import { Screen } from '../src/ui/Screen';
import { SectionHeader } from '../src/ui/SectionHeader';

const LIVE_HOURS = [1, 4, 12, 24, 72];
const CHECKIN_OPTIONS = [
  { minutes: 60, label: '1 h' },
  { minutes: 180, label: '3 h' },
  { minutes: 360, label: '6 h' },
  { minutes: 720, label: '12 h' },
];

function deviceCountry() {
  try {
    return Localization.getLocales()[0]?.regionCode ?? null;
  } catch {
    return null;
  }
}

export default function SafetyScreen() {
  const { colors } = useAppTheme();
  const { profile } = useAuth();
  const canConnect = useCanConnect();
  const toast = useToast();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [name, setName] = useState('');
  const [live, setLive] = useState<LiveShareState | null>(null);
  const [liveHours, setLiveHours] = useState(4);
  const [checkIn, setCheckInState] = useState<CheckIn | null>(null);
  const [countryCode, setCountryCode] = useState<string | null>(deviceCountry());
  const [tripTitle, setTripTitle] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setContacts(await getContacts());
    setName((await getSosName()) ?? profile?.display_name ?? '');
    setLive(await getLiveShareState());
    setCheckInState(await getCheckIn());
    // Prefer the country of the journey you are on (emergency numbers differ abroad).
    const trips = await listTrips();
    const recording = await getActiveTrackingTripId();
    const current = trips.find(t => t.id === recording) ?? trips.find(t => tripPhase(t.starts_on, t.ends_on) === 'ongoing');
    setTripTitle(current?.title ?? null);
    const cc = getDestination(current?.place_key)?.countryCode;
    if (cc) setCountryCode(cc);
  }, [profile?.display_name]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const numbers = useMemo(() => emergencyNumbersFor(countryCode), [countryCode]);

  const fix = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    try {
      return (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })).coords;
    } catch {
      return (await Location.getLastKnownPositionAsync())?.coords ?? null;
    }
  };

  const sos = async () => {
    if (!contacts.length) {
      Alert.alert('Add an emergency contact', 'SOS texts your emergency contacts with your location. Add at least one below.');
      return;
    }
    setBusy('sos');
    try {
      if (name) await setSosName(name);
      const c = await fix();
      const message = buildSosMessage({
        name: name || profile?.display_name || null,
        latitude: c?.latitude ?? null,
        longitude: c?.longitude ?? null,
        accuracyM: c?.accuracy ?? null,
        altitudeM: c?.altitude ?? null,
        at: new Date(),
        tripTitle,
        liveUrl: live ? buildLiveShareUrls(live.id).web : null,
      });
      await sendSms(contacts.map(x => x.phone), message);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not prepare SOS');
    } finally {
      setBusy(null);
    }
  };

  const confirmSos = () =>
    Alert.alert('Send SOS?', `Opens a text to ${contacts.length || 'your'} emergency contact${contacts.length === 1 ? '' : 's'} with your GPS location. In immediate danger, call ${numbers.general}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: `Call ${numbers.general}`, onPress: () => callNumber(numbers.general) },
      { text: 'Send SOS text', style: 'destructive', onPress: sos },
    ]);

  const toggleLive = async () => {
    setBusy('live');
    try {
      if (live) {
        await stopLiveSharing();
        setLive(null);
        toast('Live location stopped');
      } else {
        const state = await startLiveSharing(liveHours, tripTitle);
        setLive(state);
        const { web } = buildLiveShareUrls(state.id);
        await Share.share({ message: `Follow my live location on Wayfare for the next ${liveHours} hours:\n${web}` });
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not update live location');
    } finally {
      setBusy(null);
    }
  };

  const startTimer = async (minutes: number) => {
    try {
      setCheckInState(await startCheckIn(minutes, tripTitle));
      toast('Check-in reminder set');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not set reminder');
    }
  };

  const checkInNow = async () => {
    await cancelCheckIn();
    setCheckInState(null);
    if (!contacts.length) {
      toast('Checked in ✅');
      return;
    }
    Alert.alert('Checked in ✅', 'Let your emergency contacts know you are safe?', [
      { text: 'No thanks', style: 'cancel' },
      {
        text: 'Text them',
        onPress: async () => {
          const c = await fix().catch(() => null);
          await sendSms(
            contacts.map(x => x.phone),
            buildCheckInMessage(name || profile?.display_name || null, tripTitle, new Date()) +
              (c ? `\nhttps://maps.google.com/?q=${c.latitude.toFixed(5)},${c.longitude.toFixed(5)}` : '')
          );
        },
      },
    ]);
  };

  const add = async () => {
    try {
      setContacts(await addContact(newName, newPhone));
      setNewName('');
      setNewPhone('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add contact');
    }
  };

  return (
    <Screen onRefresh={load} refreshing={false}>
      <Pressable
        onPress={confirmSos}
        onLongPress={sos}
        style={({ pressed }) => ({
          backgroundColor: colors.danger,
          borderRadius: 24,
          padding: 20,
          alignItems: 'center',
          opacity: pressed || busy === 'sos' ? 0.85 : 1,
        })}
        accessibilityRole="button"
        accessibilityLabel="SOS. Text your emergency contacts your location"
      >
        <Icon name="alarm-light-outline" size={40} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 4 }}>SOS</Text>
        <Text style={{ color: '#ffffffe6', textAlign: 'center', marginTop: 4 }}>
          Texts {contacts.length ? `${contacts.length} contact${contacts.length === 1 ? '' : 's'}` : 'your contacts'} your GPS location{live ? ' and live link' : ''}
        </Text>
      </Pressable>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Button mode="contained-tonal" icon="phone" style={{ flex: 1 }} onPress={() => callNumber(numbers.general)}>
          Call {numbers.general}
        </Button>
        {numbers.ambulance && numbers.ambulance !== numbers.general ? (
          <Button mode="contained-tonal" icon="ambulance" style={{ flex: 1 }} onPress={() => callNumber(numbers.ambulance as string)}>
            {numbers.ambulance}
          </Button>
        ) : null}
        {numbers.tourist ? (
          <Button mode="contained-tonal" icon="account-tie-hat-outline" style={{ flex: 1 }} onPress={() => callNumber(numbers.tourist as string)}>
            {numbers.tourist}
          </Button>
        ) : null}
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
        Emergency numbers for {numbers.country}
        {numbers.tourist ? ' · tourist helpline' : ''}. Change country:
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
        {Object.entries(EMERGENCY_NUMBERS).map(([cc, n]) => (
          <Pill key={cc} label={n.country} selected={countryCode === cc} onPress={() => setCountryCode(cc)} />
        ))}
      </View>

      <SectionHeader title="Live location" subtitle="A private link for family and friends — no app needed" />
      {canConnect ? (
        <>
          {live ? (
            <Notice
              tone="success"
              icon="broadcast"
              text={`Sharing until ${new Date(live.expiresAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}. Updates about once a minute while moving.`}
            />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {LIVE_HOURS.map(h => (
                <Pill key={h} label={h === 72 ? '3 days' : `${h} h`} selected={liveHours === h} onPress={() => setLiveHours(h)} />
              ))}
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button mode={live ? 'outlined' : 'contained'} icon={live ? 'stop-circle-outline' : 'broadcast'} onPress={toggleLive} loading={busy === 'live'} disabled={busy === 'live'} style={{ flex: 1 }}>
              {live ? 'Stop sharing' : `Share live for ${liveHours === 72 ? '3 days' : `${liveHours} h`}`}
            </Button>
            {live ? (
              <Button mode="contained-tonal" icon="share-variant" onPress={() => Share.share({ message: `Follow my live location on Wayfare:\n${buildLiveShareUrls(live.id).web}` })}>
                Link
              </Button>
            ) : null}
          </View>
        </>
      ) : (
        <Notice tone="info" text="Live location links need a free Wayfare account. SOS texts and check-ins work without one." />
      )}

      <SectionHeader title="Check-in timer" subtitle="A reminder to tell your people you are OK — and a nudge to send SOS if you don't" />
      {checkIn ? (
        <View style={{ padding: 14, borderRadius: 16, backgroundColor: colors.secondaryContainer }}>
          <Text style={{ color: colors.onSecondaryContainer, fontWeight: '700' }}>
            Check in by {new Date(checkIn.dueAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', weekday: 'short' })}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Button mode="contained" icon="check-circle-outline" onPress={checkInNow} style={{ flex: 1 }}>
              I'm safe
            </Button>
            <Button onPress={async () => { await cancelCheckIn(); setCheckInState(null); }}>Cancel</Button>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CHECKIN_OPTIONS.map(o => (
            <Button key={o.minutes} mode="outlined" icon="timer-outline" onPress={() => startTimer(o.minutes)}>
              {o.label}
            </Button>
          ))}
        </View>
      )}

      <SectionHeader title="Emergency contacts" subtitle="Stored only on this phone" />
      <TextInput mode="outlined" dense label="Your name in SOS messages" value={name} onChangeText={setName} onBlur={() => setSosName(name)} style={{ marginBottom: 8 }} />
      {contacts.map(c => (
        <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Icon name="account-heart-outline" size={20} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontWeight: '700' }}>{c.name}</Text>
            <Text style={{ color: colors.muted }}>{c.phone}</Text>
          </View>
          <IconButton icon="phone-outline" onPress={() => callNumber(c.phone)} accessibilityLabel={`Call ${c.name}`} />
          <IconButton icon="delete-outline" onPress={async () => setContacts(await removeContact(c.id))} accessibilityLabel={`Remove ${c.name}`} />
        </View>
      ))}
      {contacts.length < 5 ? (
        <View style={{ gap: 8, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput mode="outlined" dense label="Name" value={newName} onChangeText={setNewName} style={{ flex: 1 }} />
            <TextInput mode="outlined" dense label="Phone" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" style={{ flex: 1.2 }} />
          </View>
          <Button mode="outlined" icon="account-plus-outline" onPress={add} disabled={!newPhone.trim()}>
            Add contact
          </Button>
        </View>
      ) : null}

      <SectionHeader title="Altitude sickness" subtitle="General guidance — not medical advice" />
      <Text style={{ color: colors.onSurfaceVariant, lineHeight: 20, marginBottom: 8 }}>{ALTITUDE_GUIDE.intro}</Text>
      {ALTITUDE_GUIDE.rules.map(r => (
        <View key={r} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
          <Icon name="check" size={16} color={colors.secondary} />
          <Text style={{ flex: 1 }}>{r}</Text>
        </View>
      ))}
      <Text style={{ fontWeight: '700', marginTop: 8 }}>Mild symptoms (AMS)</Text>
      <Text style={{ color: colors.onSurfaceVariant, marginBottom: 8 }}>{ALTITUDE_GUIDE.ams.join(' · ')}</Text>
      <Notice tone="error" icon="alert-octagon-outline" text={`${ALTITUDE_GUIDE.danger.join('. ')}. ${ALTITUDE_GUIDE.dangerAdvice}`} />

      <SectionHeader title="Before every trek" />
      {TREK_CHECKLIST.map(item => (
        <View key={item} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
          <Icon name="checkbox-marked-circle-outline" size={16} color={colors.primary} />
          <Text style={{ flex: 1 }}>{item}</Text>
        </View>
      ))}
      <SectionHeader title="Meeting new travellers" />
      {MEETUP_SAFETY.map(item => (
        <View key={item} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
          <Icon name="shield-check-outline" size={16} color={colors.secondary} />
          <Text style={{ flex: 1 }}>{item}</Text>
        </View>
      ))}
    </Screen>
  );
}
