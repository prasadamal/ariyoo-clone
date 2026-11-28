import AsyncStorage from '@react-native-async-storage/async-storage';
import { inviteLinkUrl } from '../config';
import { forgetTrip, setTripShare } from './localDb';
import { supabase } from './supabase';

/**
 * Crew: people you add to a journey, like a WhatsApp group.
 *   owner  started the journey; does everything, and is the only one who can delete it.
 *   admin  adds, edits and deletes any moment, plan item or expense; edits the details; adds or removes crew.
 *   member sees everything, changes nothing (keeps their own packing list).
 */
export {
  canEditTrip,
  cleanHandle,
  isSharedTrip,
  personName,
  ROLE_LABEL,
  tripRole,
  validHandle,
  type CrewPerson,
  type Traveller,
  type TripRole,
} from './crewRules';
import type { CrewPerson, Traveller } from './crewRules';
import { personName, validHandle } from './crewRules';

const cacheKey = (tripId: string) => `wayfare_crew_v1_${tripId}`;

/** Friendly words for whatever went wrong. */
export function crewError(e: unknown): string {
  const err = e as { code?: string; message?: string } | null;
  if (err?.code === 'PGRST202' || err?.code === '42883') return "Crew isn't switched on yet. It will work after the next server update.";
  const msg = err?.message ?? (e instanceof Error ? e.message : '');
  if (/network|fetch/i.test(msg)) return "You're offline. Try again when you have signal.";
  return msg || 'Something went wrong. Try again.';
}

/** Everyone in a journey, owner first. Falls back to the last list seen on this phone when offline. */
export async function loadCrew(tripId: string): Promise<CrewPerson[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('trip_people', { p_trip: tripId });
  if (error) {
    const cached = await AsyncStorage.getItem(cacheKey(tripId)).catch(() => null);
    if (cached) return JSON.parse(cached) as CrewPerson[];
    throw error;
  }
  const people = (data ?? []) as CrewPerson[];
  await AsyncStorage.setItem(cacheKey(tripId), JSON.stringify(people)).catch(() => undefined);
  return people;
}

/** The crew list last seen on this phone (for names on moments while offline). */
export async function cachedCrew(tripId: string): Promise<CrewPerson[]> {
  const cached = await AsyncStorage.getItem(cacheKey(tripId)).catch(() => null);
  return cached ? (JSON.parse(cached) as CrewPerson[]) : [];
}

/** PostgREST's answer when the server doesn't have a function yet (an older database). */
export function isMissingFunction(error: { code?: string; message?: string } | null) {
  return Boolean(error) && (error?.code === 'PGRST202' || /could not find the function/i.test(error?.message ?? ''));
}

/** Look someone up by exact username, for the preview before adding them. */
export async function findTraveller(handle: string): Promise<Traveller | null> {
  if (!supabase || !validHandle(handle)) return null;
  // Exact-username lookup on the server: profiles aren't readable beyond your own crew.
  const { data, error } = await supabase.rpc('find_traveller', { p_username: handle });
  if (error && isMissingFunction(error)) {
    // A server from before that function existed: the profile table still answers directly.
    const old = await supabase.from('profiles').select('id, username, display_name, avatar_path').eq('username', handle).maybeSingle();
    if (old.error) throw old.error;
    return (old.data as Traveller | null) ?? null;
  }
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as Traveller | undefined) ?? null;
}

/** Add someone, or change their role if they're already crew. */
export async function addCrew(tripId: string, handle: string, role: 'admin' | 'member') {
  if (!supabase) throw new Error('Cloud is not configured');
  const { error } = await supabase.rpc('add_trip_member', { p_trip: tripId, p_username: handle, p_role: role });
  if (error) throw error;
  await refreshCount(tripId);
}

/** A link anyone can open to join this journey as a member (valid 7 days, up to 10 people). */
export async function createInviteLink(tripId: string): Promise<string> {
  if (!supabase) throw new Error('Cloud is not configured');
  const { data, error } = await supabase.rpc('create_trip_invite', { p_trip: tripId });
  if (error) throw error;
  return inviteLinkUrl(String(data));
}

export type InvitePreview = { trip_id: string; title: string; invited_by: string };

/** What an invite is for, before joining. Null when the link has expired or was used up. */
export async function previewInvite(token: string): Promise<InvitePreview | null> {
  if (!supabase) throw new Error('Cloud is not configured');
  const { data, error } = await supabase.rpc('preview_trip_invite', { p_token: token });
  if (error) throw error;
  return ((data as InvitePreview[] | null) ?? [])[0] ?? null;
}

/** Joins the journey from an invite link; returns its id. */
export async function acceptInvite(token: string): Promise<string> {
  if (!supabase) throw new Error('Cloud is not configured');
  const { data, error } = await supabase.rpc('accept_trip_invite', { p_token: token });
  if (error) throw error;
  return String(data);
}

export async function removeCrew(tripId: string, userId: string) {
  if (!supabase) throw new Error('Cloud is not configured');
  const { error } = await supabase.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', userId);
  if (error) throw error;
  await refreshCount(tripId);
}

/** Leave someone else's journey: it disappears from this phone; what you added stays with it. */
export async function leaveTrip(tripId: string, myId: string) {
  if (!supabase) throw new Error('Cloud is not configured');
  const { error } = await supabase.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', myId);
  if (error) throw error;
  await AsyncStorage.removeItem(cacheKey(tripId)).catch(() => undefined);
  await forgetTrip(tripId);
}

/** Keep the local "shared with N people" count in step after a change. */
async function refreshCount(tripId: string) {
  const people = await loadCrew(tripId).catch(() => null);
  if (!people) return;
  const me = (await supabase!.auth.getUser()).data.user?.id;
  const mine = people.find(p => p.user_id === me);
  const owner = people.find(p => p.role === 'owner');
  await setTripShare(tripId, {
    ownerId: mine?.role === 'owner' ? null : owner?.user_id ?? null,
    ownerName: mine?.role === 'owner' || !owner ? null : personName(owner),
    role: mine?.role ?? 'owner',
    crewCount: people.length > 1 ? people.length : 0,
  });
}
