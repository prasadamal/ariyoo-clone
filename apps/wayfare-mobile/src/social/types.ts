/** Shapes returned by the Supabase RPCs in supabase/migrations/20261006*.sql. */

export type MyProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_path: string | null;
  home_region: string | null;
  home_country: string | null;
  travel_styles: string[];
  languages: string[];
  tier: string;
  privacy_default: string;
  is_discoverable: boolean;
  allow_messages: 'everyone' | 'following' | 'none';
  guidelines_accepted_at: string | null;
  verified_km: number;
  max_altitude_m: number;
  trips_count: number;
  followers_count: number;
  following_count: number;
  posts_count: number;
};

export type PublicProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_path: string | null;
  home_region: string | null;
  home_country: string | null;
  travel_styles: string[];
  languages: string[];
  tier: string;
  verified_km: number;
  max_altitude_m: number;
  trips_count: number;
  followers_count: number;
  following_count: number;
  posts_count: number;
  last_active_at: string | null;
  created_at: string;
  followed_by_me: boolean;
  follows_me: boolean;
  can_message: boolean;
  is_me: boolean;
};

export type TravellerSummary = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_path: string | null;
  tier: string;
  home_region?: string | null;
  travel_styles?: string[];
  followers_count?: number;
  followed_by_me?: boolean;
  shared_styles?: number;
};

export type PostMedia = { path: string; width?: number; height?: number };

export type FeedPost = {
  id: string;
  user_id: string;
  kind: 'moment' | 'trip' | 'milestone';
  body: string | null;
  trip_id: string | null;
  place_name: string | null;
  place_key: string | null;
  latitude: number | null;
  longitude: number | null;
  visibility: 'public' | 'followers';
  media: PostMedia[];
  route_km: number | null;
  route_preview: [number, number][] | null;
  stats: Record<string, number | string> | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  author_username: string | null;
  author_display_name: string | null;
  author_avatar_path: string | null;
  author_tier: string;
  liked_by_me: boolean;
  following_author: boolean;
};

export type FeedMode = 'following' | 'discover' | 'trending' | 'place' | 'user';

export type PostComment = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_username: string | null;
  author_display_name: string | null;
  author_avatar_path: string | null;
  author_tier: string;
};

export type NotificationKind =
  | 'follow'
  | 'like'
  | 'comment'
  | 'board_request'
  | 'board_accepted'
  | 'board_declined'
  | 'trip_match'
  | 'tip_upvote'
  | 'crew_join'
  | 'system';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  entity_type: string | null;
  entity_id: string | null;
  body: string | null;
  read_at: string | null;
  created_at: string;
  actor_id: string | null;
  actor_username: string | null;
  actor_display_name: string | null;
  actor_avatar_path: string | null;
};

export type ConversationKind = 'direct' | 'group' | 'place';

export type ConversationSummary = {
  id: string;
  kind: ConversationKind;
  title: string | null;
  place_key: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  member_count: number;
  muted: boolean;
  role: 'owner' | 'admin' | 'member';
  unread_count: number;
  invite_code: string | null;
  trip_id: string | null;
  board_post_id: string | null;
  other_user_id: string | null;
  other_username: string | null;
  other_display_name: string | null;
  other_avatar_path: string | null;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: 'text' | 'image' | 'location' | 'system';
  body: string | null;
  media_path: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  /** Client-only: optimistic message still sending / failed. */
  pending?: boolean;
  failed?: boolean;
  local_uri?: string | null;
};

export type ConversationMember = {
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  username: string | null;
  display_name: string | null;
  avatar_path: string | null;
  tier: string | null;
};

export type PlaceRoom = {
  id: string;
  title: string;
  place_key: string;
  member_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  joined: boolean;
};

export type BoardKind = 'buddy' | 'meetup' | 'ride' | 'stay';

export type BoardPost = {
  id: string;
  user_id: string;
  kind: BoardKind;
  title: string;
  body: string | null;
  place_name: string;
  place_key: string;
  starts_on: string | null;
  ends_on: string | null;
  meet_at: string | null;
  spots: number;
  budget_level: 'shoestring' | 'moderate' | 'comfort' | null;
  status: 'open' | 'full' | 'closed';
  accepted_count: number;
  pending_count: number;
  conversation_id: string | null;
  created_at: string;
  author_username: string | null;
  author_display_name: string | null;
  author_avatar_path: string | null;
  author_tier: string;
  my_request_status: 'pending' | 'accepted' | 'declined' | null;
};

export type BoardRequest = {
  id: string;
  user_id: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  username: string | null;
  display_name: string | null;
  avatar_path: string | null;
  tier: string;
  travel_styles: string[];
};

export type TipCategory =
  | 'general'
  | 'stay'
  | 'food'
  | 'water'
  | 'transport'
  | 'permit'
  | 'safety'
  | 'gear'
  | 'connectivity'
  | 'money';

export type PlaceTip = {
  id: string;
  user_id: string;
  place_key: string;
  category: TipCategory;
  body: string;
  upvotes: number;
  created_at: string;
  author_username: string | null;
  author_display_name: string | null;
  author_avatar_path: string | null;
  author_tier: string;
  voted_by_me: boolean;
};

export type NearbyTraveller = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_path: string | null;
  tier: string;
  travel_styles: string[];
  place_label: string | null;
  status_text: string | null;
  distance_km: number;
  updated_at: string;
  followed_by_me: boolean;
};

export type TripMatch = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_path: string | null;
  tier: string;
  travel_styles: string[];
  destination: string | null;
  starts_on: string | null;
  ends_on: string | null;
  overlap_days: number | null;
  followed_by_me: boolean;
};

export type HeadingTraveller = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_path: string | null;
  tier: string;
  starts_on: string | null;
  ends_on: string | null;
  followed_by_me: boolean;
};

export type ReportTarget = 'post' | 'comment' | 'message' | 'profile' | 'tip' | 'board_post' | 'conversation';
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'sexual'
  | 'violence'
  | 'scam'
  | 'unsafe'
  | 'impersonation'
  | 'other';

export const TRAVEL_STYLES: { value: string; label: string; icon: string }[] = [
  { value: 'trekker', label: 'Trekker', icon: 'hiking' },
  { value: 'backpacker', label: 'Backpacker', icon: 'bag-personal-outline' },
  { value: 'roadtripper', label: 'Road tripper', icon: 'car-side' },
  { value: 'biker', label: 'Biker', icon: 'motorbike' },
  { value: 'solo', label: 'Solo', icon: 'account-outline' },
  { value: 'photographer', label: 'Photographer', icon: 'camera-outline' },
  { value: 'foodie', label: 'Foodie', icon: 'food-outline' },
  { value: 'culture', label: 'Culture', icon: 'bank-outline' },
  { value: 'spiritual', label: 'Spiritual', icon: 'meditation' },
  { value: 'beach', label: 'Beach bum', icon: 'beach' },
  { value: 'nomad', label: 'Digital nomad', icon: 'laptop' },
  { value: 'budget', label: 'Budget', icon: 'piggy-bank-outline' },
  { value: 'comfort', label: 'Comfort', icon: 'bed-outline' },
  { value: 'wildlife', label: 'Wildlife', icon: 'paw' },
];

export function styleLabel(value: string) {
  return TRAVEL_STYLES.find(s => s.value === value)?.label ?? value;
}
