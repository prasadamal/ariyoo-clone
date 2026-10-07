import { CommunityError, currentUserId, db, friendly, rpc } from './client';
import type { AppNotification } from './types';

export async function notificationsPage(before?: string | null) {
  return rpc<AppNotification[]>('notifications_page', { p_before: before ?? null, p_limit: 40 });
}

export async function unreadNotificationCount() {
  const me = await currentUserId();
  const { count, error } = await db()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', me)
    .is('read_at', null);
  if (error) throw new CommunityError(friendly(error));
  return count ?? 0;
}

export async function markAllNotificationsRead() {
  await rpc('mark_notifications_read');
}

export async function registerPushToken(token: string, platform: string) {
  await rpc('register_push_token', { p_token: token, p_platform: platform });
}

export async function removePushToken(token: string) {
  await db().from('push_tokens').delete().eq('token', token);
}

/** Where a notification should take the traveller. */
export function notificationTarget(n: AppNotification): string {
  switch (n.kind) {
    case 'follow':
      return n.actor_id ? `/user/${n.actor_id}` : '/(tabs)/inbox';
    case 'like':
    case 'comment':
      return n.entity_id ? `/post/${n.entity_id}` : '/(tabs)/discover';
    case 'board_request':
    case 'board_accepted':
    case 'board_declined':
      return n.entity_id ? `/board/${n.entity_id}` : '/(tabs)/connect';
    case 'trip_match':
      return n.entity_id ? `/trip/${n.entity_id}?tab=crew` : '/(tabs)/connect';
    case 'crew_join':
      return n.entity_id ? `/chat/${n.entity_id}` : '/(tabs)/inbox';
    default:
      return '/(tabs)/inbox';
  }
}

export function notificationText(n: AppNotification) {
  const who = n.actor_display_name || (n.actor_username ? `@${n.actor_username}` : 'Someone');
  switch (n.kind) {
    case 'follow':
      return `${who} started following you`;
    case 'like':
      return `${who} liked your post`;
    case 'comment':
      return `${who} commented: “${n.body ?? ''}”`;
    case 'board_request':
      return `${who} asked to join “${n.body ?? 'your board post'}”`;
    case 'board_accepted':
      return `${who} accepted you for “${n.body ?? 'their trip'}” — you're in the crew chat`;
    case 'board_declined':
      return `“${n.body ?? 'A board post'}” filled up this time`;
    case 'trip_match':
      return `${who} is also heading to ${n.body ?? 'your destination'} around your dates`;
    case 'tip_upvote':
      return `${who} found your ${n.body ?? ''} tip helpful`;
    case 'crew_join':
      return `${who} joined ${n.body ?? 'your crew'}`;
    default:
      return n.body ?? 'Update from Wayfare';
  }
}

export function notificationIcon(n: AppNotification) {
  switch (n.kind) {
    case 'follow':
      return 'account-plus';
    case 'like':
      return 'heart';
    case 'comment':
      return 'comment-text';
    case 'board_request':
      return 'hand-wave';
    case 'board_accepted':
      return 'check-decagram';
    case 'board_declined':
      return 'calendar-remove';
    case 'trip_match':
      return 'account-group';
    case 'tip_upvote':
      return 'lightbulb-on';
    case 'crew_join':
      return 'account-multiple-plus';
    default:
      return 'bell';
  }
}
