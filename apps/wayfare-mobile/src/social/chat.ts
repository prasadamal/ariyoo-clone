import type { RealtimeChannel } from '@supabase/supabase-js';
import { screenText } from '../lib/contentFilter';
import { prepareImage, signedUrl, uploadFile } from '../lib/upload';
import { CommunityError, currentUserId, db, friendly, rpc } from './client';
import type { ChatMessage, ConversationMember, ConversationSummary, PlaceRoom } from './types';

export const CHAT_MEDIA_BUCKET = 'chat-media';

export async function myConversations() {
  return rpc<ConversationSummary[]>('my_conversations');
}

export type ConversationView = ConversationSummary & { joined: boolean };

export async function getConversation(id: string): Promise<ConversationView | null> {
  const mine = await myConversations();
  const hit = mine.find(c => c.id === id);
  if (hit) return { ...hit, joined: true };
  // A destination room you have not joined yet is still readable as metadata.
  const { data, error } = await db()
    .from('conversations')
    .select('id, kind, title, place_key, last_message_at, created_at, member_count, invite_code, trip_id, board_post_id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new CommunityError(friendly(error));
  if (!data) return null;
  return {
    ...(data as Pick<
      ConversationSummary,
      'id' | 'kind' | 'title' | 'place_key' | 'last_message_at' | 'created_at' | 'member_count' | 'invite_code' | 'trip_id' | 'board_post_id'
    >),
    last_message_preview: null,
    muted: false,
    role: 'member',
    unread_count: 0,
    other_user_id: null,
    other_username: null,
    other_display_name: null,
    other_avatar_path: null,
    joined: false,
  };
}

export async function startDirect(userId: string) {
  return rpc<string>('start_direct_conversation', { p_other: userId });
}

export async function createGroup(title: string, memberIds: string[] = [], tripId?: string | null) {
  return rpc<string>('create_group_conversation', { p_title: title, p_member_ids: memberIds, p_trip_id: tripId ?? null });
}

export async function joinByCode(code: string) {
  return rpc<string>('join_conversation_by_code', { p_code: code.trim() });
}

export async function joinPlaceRoom(placeKey: string, title: string) {
  return rpc<string>('join_place_room', { p_place_key: placeKey, p_title: title });
}

export async function leaveConversation(id: string) {
  await rpc('leave_conversation', { p_conversation: id });
}

export async function removeMember(conversationId: string, userId: string) {
  await rpc('remove_conversation_member', { p_conversation: conversationId, p_user: userId });
}

export async function listMembers(conversationId: string) {
  return rpc<ConversationMember[]>('conversation_members_list', { p_conversation: conversationId });
}

export async function placeRooms(query?: string) {
  return rpc<PlaceRoom[]>('place_rooms', { p_query: query?.trim() || null, p_limit: 40 });
}

/** Newest first. */
export async function messagesPage(conversationId: string, before?: string | null, limit = 40) {
  return rpc<ChatMessage[]>('conversation_messages', {
    p_conversation: conversationId,
    p_before: before ?? null,
    p_limit: limit,
  });
}

export async function markRead(conversationId: string) {
  await rpc('mark_conversation_read', { p_conversation: conversationId }).catch(() => undefined);
}

export async function setMuted(conversationId: string, muted: boolean) {
  const me = await currentUserId();
  const { error } = await db()
    .from('conversation_members')
    .update({ muted })
    .eq('conversation_id', conversationId)
    .eq('user_id', me);
  if (error) throw new CommunityError(friendly(error));
}

async function insertMessage(row: Partial<ChatMessage> & { id: string; conversation_id: string }) {
  const me = await currentUserId();
  const { data, error } = await db()
    .from('messages')
    .insert({ ...row, sender_id: me })
    .select('*')
    .single();
  if (error) throw new CommunityError(friendly(error));
  return data as ChatMessage;
}

export async function sendText(conversationId: string, id: string, body: string) {
  const check = screenText(body);
  if (!check.ok) throw new CommunityError(check.reason);
  return insertMessage({ id, conversation_id: conversationId, kind: 'text', body: body.trim() });
}

export async function sendImage(conversationId: string, id: string, localUri: string, size?: { width?: number; height?: number }) {
  const img = await prepareImage(localUri, 1280, 0.7, size);
  const path = `${conversationId}/${id}.jpg`;
  await uploadFile({ bucket: CHAT_MEDIA_BUCKET, path, localUri: img.uri, contentType: 'image/jpeg' });
  return insertMessage({ id, conversation_id: conversationId, kind: 'image', media_path: path });
}

export async function sendLocation(conversationId: string, id: string, latitude: number, longitude: number, label?: string) {
  return insertMessage({ id, conversation_id: conversationId, kind: 'location', latitude, longitude, body: label ?? null });
}

export async function deleteMessage(id: string) {
  const { error } = await db().from('messages').delete().eq('id', id);
  if (error) throw new CommunityError(friendly(error));
}

export function chatImageUrl(path: string) {
  return signedUrl(CHAT_MEDIA_BUCKET, path, 3600);
}

/** Live messages for one conversation. Returns an unsubscribe function. */
export function subscribeToConversation(
  conversationId: string,
  handlers: { onInsert: (m: ChatMessage) => void; onDelete?: (id: string) => void }
) {
  const client = db();
  const channel: RealtimeChannel = client
    .channel(`conversation:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      payload => handlers.onInsert(payload.new as ChatMessage)
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      payload => handlers.onDelete?.((payload.old as { id: string }).id)
    )
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}

/** Any new message or notification for the signed-in traveller (RLS-filtered by Realtime). */
export function subscribeToInbox(userId: string, onChange: (what: 'message' | 'notification') => void) {
  const client = db();
  const channel = client
    .channel(`inbox:${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => onChange('message'))
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      () => onChange('notification')
    )
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
