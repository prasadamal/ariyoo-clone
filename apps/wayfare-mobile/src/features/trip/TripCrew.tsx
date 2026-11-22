import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { ActivityIndicator, Button, Menu, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { useAuth, useCanConnect } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { useToast } from '../../context/ToastContext';
import {
  addCrew,
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
import { SectionHeader } from '../../ui/SectionHeader';

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
  const [newRole, setNewRole] = useState<'member' | 'admin'>('member');
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
      await addCrew(trip.id, clean, newRole);
      toast(`${found ? personName(found) : '@' + clean} added as ${newRole === 'admin' ? 'an admin' : 'a member'}`);
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

  return (
    <View>
      <Text style={{ color: colors.muted, lineHeight: 20, marginBottom: 12 }}>
        Everyone here sees the whole journey. Admins can also add, edit and delete moments, plans and expenses, and add people, like a group admin.
      </Text>

      {manage ? (
        <View style={{ padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 6 }}>
          <TextInput
            mode="outlined"
            dense
            label="Add by username"
            placeholder="@username"
            value={handle}
            onChangeText={setHandle}
            autoCapitalize="none"
            autoCorrect={false}
            left={<TextInput.Icon icon="at" />}
            onSubmitEditing={add}
            returnKeyType="done"
          />
          {validHandle(clean) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
              {found ? (
                <>
                  <Avatar id={found.id} name={personName(found)} path={found.avatar_path} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700' }} numberOfLines={1}>{personName(found)}</Text>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>@{found.username}</Text>
                  </View>
                </>
              ) : found === null ? (
                <Text style={{ color: colors.muted, flex: 1 }}>No traveller with that username</Text>
              ) : (
                <ActivityIndicator size="small" />
              )}
            </View>
          ) : null}
          <SegmentedButtons
            value={newRole}
            onValueChange={v => setNewRole(v as 'member' | 'admin')}
            style={{ marginTop: 10 }}
            buttons={[
              { value: 'member', label: 'Member', icon: 'eye-outline' },
              { value: 'admin', label: 'Admin', icon: 'shield-account-outline' },
            ]}
          />
          <Button mode="contained" icon="account-plus" onPress={add} loading={busy} disabled={busy || !found} style={{ marginTop: 10 }}>
            Add to journey
          </Button>
        </View>
      ) : (
        <Notice text="You're a member: you can see everything. An admin can make you an admin so you can add moments too." />
      )}

      <SectionHeader title="Crew" subtitle={people && people.length > 1 ? `${people.length} people` : undefined} />
      {error ? <Notice tone="warning" text={error} /> : null}
      {people === null ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
      {people && people.length <= 1 && !error ? (
        <Text style={{ color: colors.muted, marginBottom: 8 }}>Just you so far.</Text>
      ) : null}
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

      {role !== 'owner' ? (
        <Button mode="outlined" icon="exit-run" textColor={colors.error} style={{ marginTop: 18, borderColor: colors.error }} onPress={leave}>
          Leave journey
        </Button>
      ) : null}
    </View>
  );
}
