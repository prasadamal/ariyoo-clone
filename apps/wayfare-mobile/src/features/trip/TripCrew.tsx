import { router } from 'expo-router';
import { track } from '../../lib/telemetry';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Share, View } from 'react-native';
import { ActivityIndicator, Button, Menu, Text, TextInput } from 'react-native-paper';
import { useAuth, useCanConnect } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { useToast } from '../../context/ToastContext';
import {
  addCrew,
  createInviteLink,
  canEditTrip,
  cleanHandle,
  crewError,
  findTraveller,
  leaveTrip,
  loadCrew,
  personName,
  removeCrew,
  ROLE_LABEL,
  tripRole,
  validHandle,
  type CrewPerson,
  type Traveller,
} from '../../lib/crew';
import type { LocalTrip } from '../../lib/localDb';
import { pushTripNow } from '../../lib/sync';
import { useAppTheme } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Icon } from '../../ui/Icon';
import { Notice } from '../../ui/Notice';

type Props = { trip: LocalTrip; onChanged: () => void; onCrew?: (people: CrewPerson[]) => void };

/**
 * Crew: add people to this journey by username, like adding people to a WhatsApp group.
 * Members see everything; admins can also add, edit and delete, and manage the crew.
 */
export function TripCrew({ trip, onChanged, onCrew }: Props) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const canConnect = useCanConnect();
  const { syncNow } = useSync();
  const toast = useToast();
  const role = tripRole(trip);
  const manage = canEditTrip(trip);
  const [people, setPeople] = useState<CrewPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState('');
  const [found, setFound] = useState<Traveller | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canConnect) return;
    try {
      const list = await loadCrew(trip.id);
      setPeople(list);
      setError(null);
      onCrew?.(list);
    } catch (e) {
      // A journey that was never synced has no crew yet: that's not an error worth showing.
      setPeople([]);
      setError(trip.sync_status === 'pending' && role === 'owner' ? null : crewError(e));
    }
  }, [canConnect, trip.id, trip.sync_status, role, onCrew]);

  useEffect(() => {
    load();
  }, [load]);

  // Look the username up as it's typed (after a short pause) so you see who you're adding.
  const clean = cleanHandle(handle);
  useEffect(() => {
    if (!validHandle(clean)) {
      setFound(undefined);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      findTraveller(clean)
        .then(t => alive && setFound(t))
        .catch(() => alive && setFound(undefined));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [clean]);

  if (!canConnect || !user) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 24, gap: 10 }}>
        <Icon name="account-group-outline" size={40} color={colors.muted} />
        <Text variant="titleMedium" style={{ fontWeight: '800' }}>Travel together</Text>
        <Text style={{ color: colors.muted, textAlign: 'center', lineHeight: 20 }}>
          Sign in to add friends to this journey. They see every moment, and admins can add their own.
        </Text>
        <Button mode="contained" onPress={() => router.push('/login')}>Sign in</Button>
      </View>
    );
  }

  const changed = async () => {
    await load();
    onChanged();
    syncNow().catch(() => undefined);
  };

  const add = async () => {
    if (!validHandle(clean)) return;
    setBusy(true);
    try {
      // The journey must be in the cloud before anyone can join it.
      if (role === 'owner') await pushTripNow(user.id, trip.id);
      // New people join as members; an admin can make them admins from their row's menu.
      await addCrew(trip.id, clean, 'member');
      toast(`${found ? personName(found) : '@' + clean} added to the journey`);
      setHandle('');
      setFound(undefined);
      await changed();
    } catch (e) {
      toast(crewError(e));
    } finally {
      setBusy(false);
    }
  };

  const setRole = async (p: CrewPerson, next: 'admin' | 'member') => {
    setMenuFor(null);
    try {
      await addCrew(trip.id, p.username ?? '', next);
      await changed();
    } catch (e) {
      toast(crewError(e));
    }
  };

  const remove = (p: CrewPerson) => {
    setMenuFor(null);
    Alert.alert(`Remove ${personName(p)}?`, 'They will no longer see this journey. Anything they added stays.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeCrew(trip.id, p.user_id);
            await changed();
          } catch (e) {
            toast(crewError(e));
          }
        },
      },
    ]);
  };

  const leave = () =>
    Alert.alert('Leave this journey?', 'It disappears from your phone. Moments you added stay in the journey.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveTrip(trip.id, user.id);
            router.replace('/(tabs)');
          } catch (e) {
            toast(crewError(e));
          }
        },
      },
    ]);

  const [inviting, setInviting] = useState(false);
  const inviteBusy = useRef(false);
  const shareInvite = async () => {
    if (inviteBusy.current) return;
    inviteBusy.current = true;
    setInviting(true);
    try {
      const url = await createInviteLink(trip.id);
      await Share.share({ message: `Join my journey “${trip.title}” on Wayfare: ${url}` });
      void track('invite_sent');
    } catch (e) {
      toast(crewError(e));
    } finally {
      inviteBusy.current = false;
      setInviting(false);
    }
  };

  return (
    <View>
      {/* The people first; adding someone is the small box underneath. */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
        <Text variant="titleMedium" style={{ fontWeight: '800' }}>Crew</Text>
        {people && people.length > 1 ? <Text style={{ color: colors.muted }}>{people.length}</Text> : null}
      </View>
      <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>Everyone here sees the whole journey. Admins can also add and edit.</Text>
      {error ? <Notice tone="warning" text={error} /> : null}
      {people === null ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
      {people?.map(p => {
        const me = p.user_id === user.id;
        const canManage = manage && !me && p.role !== 'owner';
        const row = (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Avatar id={p.user_id} name={personName(p)} path={p.avatar_path} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700' }} numberOfLines={1}>
                {personName(p)}
                {me ? <Text style={{ color: colors.muted, fontWeight: '400' }}>  (you)</Text> : null}
              </Text>
              {p.username ? <Text style={{ color: colors.muted, fontSize: 13 }}>@{p.username}</Text> : null}
            </View>
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: p.role === 'member' ? colors.surfaceVariant : colors.primaryContainer }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: p.role === 'member' ? colors.onSurfaceVariant : colors.onPrimaryContainer }}>{ROLE_LABEL[p.role]}</Text>
            </View>
            {canManage ? <Icon name="dots-vertical" size={20} color={colors.muted} /> : null}
          </View>
        );
        if (!canManage) return <View key={p.user_id}>{row}</View>;
        return (
          <Menu
            key={p.user_id}
            visible={menuFor === p.user_id}
            onDismiss={() => setMenuFor(null)}
            anchor={
              <Pressable onPress={() => setMenuFor(p.user_id)} accessibilityRole="button" accessibilityLabel={`Options for ${personName(p)}`}>
                {row}
              </Pressable>
            }
          >
            {p.role === 'member' ? (
              <Menu.Item leadingIcon="shield-account-outline" title="Make admin" onPress={() => setRole(p, 'admin')} />
            ) : (
              <Menu.Item leadingIcon="shield-off-outline" title="Dismiss as admin" onPress={() => setRole(p, 'member')} />
            )}
            <Menu.Item leadingIcon="account-remove-outline" title="Remove from journey" onPress={() => remove(p)} />
          </Menu>
        );
      })}


      {manage ? (
        <View style={{ marginTop: 18, padding: 12, borderRadius: 16, backgroundColor: colors.surfaceVariant }}>
          <Text style={{ fontWeight: '700', marginBottom: 8 }}>Add people</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              mode="outlined"
              dense
              placeholder="@username"
              value={handle}
              onChangeText={setHandle}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={add}
              returnKeyType="done"
              style={{ flex: 1, backgroundColor: colors.surface }}
              accessibilityLabel="Add by username"
            />
            <Button mode="contained" onPress={add} loading={busy} disabled={busy || !found} compact>
              Add
            </Button>
          </View>
          {validHandle(clean) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
              {found ? (
                <>
                  <Avatar id={found.id} name={personName(found)} path={found.avatar_path} size={32} />
                  <Text style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>
                    {personName(found)} <Text style={{ color: colors.muted, fontWeight: '400' }}>@{found.username}</Text>
                  </Text>
                </>
              ) : found === null ? (
                <Text style={{ color: colors.muted, flex: 1 }}>No traveller with that username</Text>
              ) : (
                <ActivityIndicator size="small" />
              )}
            </View>
          ) : null}
          {/* Friends without Wayfare (or whose username you don't know): send them a link instead. */}
          <Button icon="link-variant" onPress={shareInvite} loading={inviting} disabled={inviting} style={{ alignSelf: 'flex-start', marginTop: 6 }} compact>
            Invite with a link
          </Button>
          <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }}>Works for 7 days, up to 10 people. They join as members.</Text>
        </View>
      ) : (
        <Notice text="You're a member: you see the whole journey. An admin can make you an admin to add moments too." />
      )}

      {role !== 'owner' ? (
        <Button mode="outlined" icon="exit-run" textColor={colors.error} style={{ marginTop: 18, borderColor: colors.error }} onPress={leave}>
          Leave journey
        </Button>
      ) : null}
    </View>
  );
}
