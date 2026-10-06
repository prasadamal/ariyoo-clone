import { screenText } from '../lib/contentFilter';
import { CommunityError, currentUserId, db, friendly, rpc } from './client';
import type { HeadingTraveller, PlaceTip, TipCategory } from './types';

export const TIP_CATEGORIES: { value: TipCategory; label: string; icon: string }[] = [
  { value: 'general', label: 'General', icon: 'lightbulb-on-outline' },
  { value: 'stay', label: 'Stay', icon: 'bed-outline' },
  { value: 'food', label: 'Food', icon: 'silverware-fork-knife' },
  { value: 'water', label: 'Water', icon: 'water-outline' },
  { value: 'transport', label: 'Transport', icon: 'bus' },
  { value: 'permit', label: 'Permits', icon: 'card-account-details-outline' },
  { value: 'safety', label: 'Safety', icon: 'shield-check-outline' },
  { value: 'gear', label: 'Gear', icon: 'bag-personal-outline' },
  { value: 'connectivity', label: 'Network', icon: 'signal-cellular-2' },
  { value: 'money', label: 'Money', icon: 'cash' },
];

export function tipCategoryMeta(c: TipCategory) {
  return TIP_CATEGORIES.find(x => x.value === c) ?? TIP_CATEGORIES[0];
}

export async function listTips(placeKey: string) {
  return rpc<PlaceTip[]>('place_tips_page', { p_place_key: placeKey, p_limit: 60 });
}

export async function addTip(placeKey: string, placeName: string, category: TipCategory, body: string) {
  const check = screenText(body);
  if (!check.ok) throw new CommunityError(check.reason);
  const me = await currentUserId();
  const { error } = await db()
    .from('place_tips')
    .insert({ user_id: me, place_key: placeKey, place_name: placeName, category, body: body.trim() });
  if (error) throw new CommunityError(friendly(error));
}

export async function deleteTip(id: string) {
  const { error } = await db().from('place_tips').delete().eq('id', id);
  if (error) throw new CommunityError(friendly(error));
}

export async function setTipVote(tipId: string, voted: boolean) {
  const me = await currentUserId();
  if (voted) {
    const { error } = await db().from('place_tip_votes').insert({ tip_id: tipId, user_id: me });
    if (error && !/duplicate key/i.test(error.message)) throw new CommunityError(friendly(error));
  } else {
    const { error } = await db().from('place_tip_votes').delete().eq('tip_id', tipId).eq('user_id', me);
    if (error) throw new CommunityError(friendly(error));
  }
}

export async function travellersHeadingTo(placeKey: string) {
  return rpc<HeadingTraveller[]>('travellers_heading_to', { p_place_key: placeKey, p_limit: 40 });
}
