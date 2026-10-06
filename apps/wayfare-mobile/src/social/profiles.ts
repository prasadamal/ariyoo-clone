import { v4 as uuid } from 'uuid';
import { prepareImage, uploadFile } from '../lib/upload';
import { CommunityError, currentUserId, db, friendly, rpc } from './client';
import type { MyProfile, PublicProfile, TravellerSummary } from './types';

const MY_PROFILE_COLUMNS =
  'id, username, display_name, bio, avatar_path, home_region, home_country, travel_styles, languages, tier, privacy_default, ' +
  'is_discoverable, allow_messages, guidelines_accepted_at, verified_km, max_altitude_m, trips_count, followers_count, ' +
  'following_count, posts_count';

export async function fetchMyProfile(userId: string): Promise<MyProfile | null> {
  const { data, error } = await db().from('profiles').select(MY_PROFILE_COLUMNS).eq('id', userId).maybeSingle();
  if (error) throw new CommunityError(friendly(error));
  if (!data) return null;
  const row = data as unknown as MyProfile;
  return {
    ...row,
    travel_styles: row.travel_styles ?? [],
    languages: row.languages ?? [],
    verified_km: Number(row.verified_km ?? 0),
    max_altitude_m: Number(row.max_altitude_m ?? 0),
  };
}

export type ProfilePatch = Partial<
  Pick<
    MyProfile,
    | 'username'
    | 'display_name'
    | 'bio'
    | 'avatar_path'
    | 'home_region'
    | 'home_country'
    | 'travel_styles'
    | 'languages'
    | 'is_discoverable'
    | 'allow_messages'
    | 'privacy_default'
    | 'guidelines_accepted_at'
  >
>;

export async function updateMyProfile(patch: ProfilePatch) {
  const userId = await currentUserId();
  const { error } = await db()
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) {
    if (/profiles_username_key|duplicate key/i.test(error.message)) throw new CommunityError('That username is taken.');
    if (/profiles_username_format/i.test(error.message)) {
      throw new CommunityError('Usernames are 3–24 characters: lowercase letters, numbers, dots and underscores.');
    }
    throw new CommunityError(friendly(error));
  }
}

export async function touchLastActive() {
  try {
    const userId = await currentUserId();
    await db().from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', userId);
  } catch {
    // best effort
  }
}

export async function usernameAvailable(username: string) {
  return rpc<boolean>('username_available', { p_username: username });
}

export function normalizeUsername(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 24);
}

export async function uploadAvatar(localUri: string, size?: { width?: number; height?: number }) {
  const userId = await currentUserId();
  const img = await prepareImage(localUri, 640, 0.85, size);
  const path = `${userId}/avatar-${uuid()}.jpg`;
  await uploadFile({ bucket: 'avatars', path, localUri: img.uri, contentType: 'image/jpeg' });
  return path;
}

export async function getProfile(params: { id?: string; username?: string }): Promise<PublicProfile | null> {
  const rows = await rpc<PublicProfile[]>('get_profile', {
    p_user: params.id ?? null,
    p_username: params.username ?? null,
  });
  const p = rows?.[0];
  if (!p) return null;
  return { ...p, verified_km: Number(p.verified_km ?? 0), max_altitude_m: Number(p.max_altitude_m ?? 0) };
}

export async function follow(userId: string) {
  const me = await currentUserId();
  const { error } = await db().from('follows').insert({ follower_id: me, followee_id: userId });
  if (error && !/duplicate key/i.test(error.message)) throw new CommunityError(friendly(error));
}

export async function unfollow(userId: string) {
  const me = await currentUserId();
  const { error } = await db().from('follows').delete().eq('follower_id', me).eq('followee_id', userId);
  if (error) throw new CommunityError(friendly(error));
}

export async function removeFollower(userId: string) {
  const me = await currentUserId();
  const { error } = await db().from('follows').delete().eq('follower_id', userId).eq('followee_id', me);
  if (error) throw new CommunityError(friendly(error));
}

export async function searchTravellers(query: string) {
  if (query.trim().length < 2) return [];
  return rpc<TravellerSummary[]>('search_travellers', { p_query: query.trim(), p_limit: 25 });
}

export async function suggestedTravellers(limit = 12) {
  return rpc<TravellerSummary[]>('suggested_travellers', { p_limit: limit });
}

export async function listFollows(userId: string, direction: 'followers' | 'following', before?: string) {
  return rpc<(TravellerSummary & { followed_at: string })[]>('list_follows', {
    p_user: userId,
    p_direction: direction,
    p_before: before ?? null,
    p_limit: 50,
  });
}

export async function block(userId: string) {
  const me = await currentUserId();
  const { error } = await db().from('blocks').insert({ blocker_id: me, blocked_id: userId });
  if (error && !/duplicate key/i.test(error.message)) throw new CommunityError(friendly(error));
}

export async function unblock(userId: string) {
  const me = await currentUserId();
  const { error } = await db().from('blocks').delete().eq('blocker_id', me).eq('blocked_id', userId);
  if (error) throw new CommunityError(friendly(error));
}

export async function listBlocked(): Promise<TravellerSummary[]> {
  const rows = await rpc<{ id: string; username: string | null; display_name: string | null; avatar_path: string | null }[]>(
    'my_blocked_profiles'
  );
  return rows.map(r => ({ ...r, tier: 'traveler' }));
}

/** Removes the caller's uploaded files, then deletes the account (cascades all rows). */
export async function deleteMyAccount() {
  const me = await currentUserId();
  const client = db();
  for (const bucket of ['entry-media', 'avatars', 'post-media']) {
    try {
      const files = await listAllFiles(bucket, me);
      for (let i = 0; i < files.length; i += 100) {
        await client.storage.from(bucket).remove(files.slice(i, i + 100));
      }
    } catch {
      // Storage cleanup is best effort; the account row deletion below is what matters.
    }
  }
  await rpc('delete_my_account');
  // The account no longer exists server-side, so only clear the local session.
  await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
}

async function listAllFiles(bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  const { data } = await db().storage.from(bucket).list(prefix, { limit: 1000 });
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`;
    // Folders have no id/metadata in storage listings.
    if (item.id) out.push(path);
    else out.push(...(await listAllFiles(bucket, path)));
  }
  return out;
}
