import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Share, Switch, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { SignInPrompt } from '../../components/SignInPrompt';
import { UserRow } from '../../components/UserRow';
import { useAuth, useCanConnect } from '../../context/AuthContext';
import { useInbox } from '../../context/InboxContext';
import { useToast } from '../../context/ToastContext';
import { formatDateRange } from '../../lib/format';
import { updateTrip, type LocalTrip } from '../../lib/localDb';
import { placeLabel } from '../../lib/places';
import { parseCompanions } from '../../lib/split';
import { pushTripNow } from '../../lib/sync';
import { createGroup, joinPlaceRoom, startDirect } from '../../social/chat';
import { findTripMatches } from '../../social/connect';
import type { TripMatch } from '../../social/types';
import { useAppTheme } from '../../theme';
import { EmptyState } from '../../ui/EmptyState';
import { Notice } from '../../ui/Notice';
import { Pill } from '../../ui/Pill';
import { SectionHeader } from '../../ui/SectionHeader';

type Props = { trip: LocalTrip; onChanged: () => void };

export function CrewTab({ trip, onChanged }: Props) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const canConnect = useCanConnect();
  const { conversations, refresh } = useInbox();
  const toast = useToast();
  const [matches, setMatches] = useState<TripMatch[] | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const companions = useMemo(() => parseCompanions(trip.companions), [trip.companions]);
  const crewChat = conversations.find(c => c.trip_id === trip.id && c.kind === 'group');
  const place = placeLabel(trip.place_key, trip.destination);

  const loadMatches = useCallback(async () => {
    if (!canConnect || !trip.open_to_meet) {
      setMatches(null);
      return;
    }
    try {
      if (user && trip.sync_status === 'pending') await pushTripNow(user.id, trip.id);
      setMatches(await findTripMatches(trip.id));
      setMatchError(null);
    } catch (e) {
      setMatchError(e instanceof Error ? e.message : 'Could not load matches');
    }
  }, [canConnect, trip.open_to_meet, trip.id, trip.sync_status, user]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  if (!canConnect) return <SignInPrompt what="meet travellers on your dates" />;

  const toggleOpen = async (open: boolean) => {
    setBusy(true);
    try {
      await updateTrip(trip.id, { open_to_meet: open ? 1 : 0 });
      if (user) await pushTripNow(user.id, trip.id);
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Saved offline — will update when online');
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const openCrewChat = async () => {
    if (crewChat) {
      router.push(`/chat/${crewChat.id}`);
      return;
    }
    setBusy(true);
    try {
      const id = await createGroup(`${trip.title} crew`, [], trip.id);
      await refresh();
      router.push(`/chat/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create crew chat');
    } finally {
      setBusy(false);
    }
  };

  const inviteToCrew = () => {
    if (!crewChat?.invite_code) return;
    Share.share({
      message: `Join our "${trip.title}" crew on Wayfare 🎒\nInvite code: ${crewChat.invite_code}\nOpen: wayfare://join/${crewChat.invite_code}`,
    });
  };

  const message = async (userId: string) => {
    try {
      const id = await startDirect(userId);
      router.push(`/chat/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not start chat');
    }
  };

  const joinRoom = async () => {
    if (!trip.place_key) return;
    try {
      const id = await joinPlaceRoom(trip.place_key, place);
      router.push(`/chat/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not join room');
    }
  };

  return (
    <View>
      <SectionHeader title="Your crew" subtitle={companions.length ? companions.join(', ') : 'Plan, chat and split costs together'} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button mode="contained" icon="forum-outline" onPress={openCrewChat} loading={busy && !crewChat} style={{ flex: 1 }}>
          {crewChat ? 'Open crew chat' : 'Start crew chat'}
        </Button>
        {crewChat?.invite_code ? (
          <Button mode="outlined" icon="account-plus-outline" onPress={inviteToCrew}>
            Invite
          </Button>
        ) : null}
      </View>
      {crewChat?.invite_code ? (
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
          Invite code {crewChat.invite_code} · {crewChat.member_count} in the crew
        </Text>
      ) : null}

      <SectionHeader title="Travellers on your dates" subtitle={place ? `Heading to ${place}` : undefined} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.secondaryContainer }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', color: colors.onSecondaryContainer }}>Open to meet</Text>
          <Text style={{ color: colors.onSecondaryContainer, fontSize: 12, marginTop: 2 }}>
            Matching shows your name and dates to travellers heading to the same place — never your journal or location.
          </Text>
        </View>
        <Switch value={trip.open_to_meet === 1} onValueChange={toggleOpen} disabled={busy} />
      </View>
      {!trip.place_key || !trip.starts_on ? (
        <Notice tone="info" text="Add a destination and start date (Edit) so we can find travellers around your dates." />
      ) : null}
      {matchError ? <Notice tone="warning" text={matchError} /> : null}
      {trip.open_to_meet && matches ? (
        matches.length ? (
          matches.map(m => (
            <UserRow
              key={m.user_id}
              id={m.user_id}
              username={m.username}
              name={m.display_name}
              avatarPath={m.avatar_path}
              tier={m.tier}
              subtitle={`${formatDateRange(m.starts_on, m.ends_on)}${m.overlap_days ? ` · ${m.overlap_days} day${m.overlap_days === 1 ? '' : 's'} overlap` : ' · nearby dates'}`}
              right={<Button compact mode="contained-tonal" onPress={() => message(m.user_id)}>Say hi</Button>}
            />
          ))
        ) : (
          <EmptyState compact icon="account-search-outline" title="No matches yet" body="We will notify you when someone heading here around your dates opens up." />
        )
      ) : null}

      {trip.place_key ? (
        <>
          <SectionHeader title={`${place} community`} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Pill icon="forum-outline" label="Join destination room" onPress={joinRoom} />
            <Pill icon="map-marker-radius-outline" label="Tips & who's going" onPress={() => router.push(`/place/${trip.place_key}`)} />
            <Pill icon="bulletin-board" label="Board posts here" onPress={() => router.push({ pathname: '/(tabs)/connect', params: { placeKey: trip.place_key } })} />
          </View>
        </>
      ) : null}
    </View>
  );
}
