import { screenText } from '../lib/contentFilter';
import { placeKeyFor } from '../lib/places';
import { CommunityError, currentUserId, db, friendly, rpc } from './client';
import type { BoardKind, BoardPost, BoardRequest } from './types';

export const BOARD_KINDS: { value: BoardKind; label: string; icon: string; blurb: string }[] = [
  { value: 'buddy', label: 'Travel buddy', icon: 'account-multiple-plus-outline', blurb: 'Find people for a trip or trek' },
  { value: 'meetup', label: 'Meetup', icon: 'coffee-outline', blurb: 'Chai, sunset, a hike — meet up nearby' },
  { value: 'ride', label: 'Ride share', icon: 'car-multiple', blurb: 'Split a cab, jeep or bike ride' },
  { value: 'stay', label: 'Stay share', icon: 'bed-outline', blurb: 'Share a room, camp or homestay' },
];

export function boardKindMeta(kind: BoardKind) {
  return BOARD_KINDS.find(k => k.value === kind) ?? BOARD_KINDS[0];
}

export async function boardPage(params: { kind?: BoardKind | null; placeKey?: string | null; mine?: boolean; before?: string | null }) {
  return rpc<BoardPost[]>('board_page', {
    p_kind: params.kind ?? null,
    p_place_key: params.placeKey ?? null,
    p_mine: !!params.mine,
    p_before: params.before ?? null,
    p_limit: 20,
  });
}

export async function getBoardPost(id: string): Promise<BoardPost | null> {
  const rows = await rpc<BoardPost[]>('board_page', { p_post: id });
  return rows?.[0] ?? null;
}

export type NewBoardPost = {
  kind: BoardKind;
  title: string;
  body?: string;
  placeName: string;
  startsOn?: string | null;
  endsOn?: string | null;
  meetAt?: string | null;
  spots: number;
  budgetLevel?: 'shoestring' | 'moderate' | 'comfort' | null;
};

export async function createBoardPost(input: NewBoardPost) {
  for (const text of [input.title, input.body ?? '']) {
    const check = screenText(text);
    if (!check.ok) throw new CommunityError(check.reason);
  }
  const placeKey = placeKeyFor(input.placeName);
  if (!placeKey) throw new CommunityError('Add where this is happening.');
  const me = await currentUserId();
  const { data, error } = await db()
    .from('board_posts')
    .insert({
      user_id: me,
      kind: input.kind,
      title: input.title.trim(),
      body: input.body?.trim() || null,
      place_name: input.placeName.trim(),
      place_key: placeKey,
      starts_on: input.startsOn || null,
      ends_on: input.endsOn || null,
      meet_at: input.meetAt || null,
      spots: input.spots,
      budget_level: input.budgetLevel ?? null,
    })
    .select('id')
    .single();
  if (error) throw new CommunityError(friendly(error));
  return data.id as string;
}

export async function setBoardStatus(id: string, status: 'open' | 'closed') {
  const { error } = await db().from('board_posts').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new CommunityError(friendly(error));
}

export async function updateBoardSpots(id: string, spots: number) {
  const { error } = await db()
    .from('board_posts')
    .update({ spots, status: 'open', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new CommunityError(friendly(error));
}

export async function deleteBoardPost(id: string) {
  const { error } = await db().from('board_posts').delete().eq('id', id);
  if (error) throw new CommunityError(friendly(error));
}

export async function requestToJoin(postId: string, message: string) {
  const check = screenText(message);
  if (!check.ok) throw new CommunityError(check.reason);
  const me = await currentUserId();
  const { error } = await db().from('board_requests').insert({ post_id: postId, user_id: me, message: message.trim() || null });
  if (error) {
    if (/duplicate key/i.test(error.message)) throw new CommunityError('You already asked to join.');
    if (/row-level security/i.test(error.message)) throw new CommunityError('This post is no longer taking requests.');
    throw new CommunityError(friendly(error));
  }
}

export async function withdrawRequest(postId: string) {
  const me = await currentUserId();
  const { error } = await db().from('board_requests').delete().eq('post_id', postId).eq('user_id', me);
  if (error) throw new CommunityError(friendly(error));
}

export async function requestsForPost(postId: string) {
  return rpc<BoardRequest[]>('board_requests_for_post', { p_post: postId });
}

/** Accepting returns the crew chat id the traveller was added to. */
export async function respondToRequest(requestId: string, accept: boolean) {
  return rpc<string | null>('respond_board_request', { p_request: requestId, p_accept: accept });
}
