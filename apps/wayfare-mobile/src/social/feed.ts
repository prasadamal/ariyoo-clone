import { v4 as uuid } from 'uuid';
import { screenText } from '../lib/contentFilter';
import { prepareImage, publicUrl, uploadFile } from '../lib/upload';
import { CommunityError, currentUserId, db, friendly, rpc } from './client';
import type { FeedMode, FeedPost, PostComment, PostMedia } from './types';

export const POST_MEDIA_BUCKET = 'post-media';

export function postMediaUrl(path: string) {
  return publicUrl(POST_MEDIA_BUCKET, path) ?? '';
}

function normalize(p: FeedPost): FeedPost {
  return {
    ...p,
    media: Array.isArray(p.media) ? p.media : [],
    route_km: p.route_km == null ? null : Number(p.route_km),
    route_preview: Array.isArray(p.route_preview) ? p.route_preview : null,
  };
}

export async function feedPage(params: {
  mode: FeedMode;
  placeKey?: string | null;
  userId?: string | null;
  before?: string | null;
  offset?: number;
  limit?: number;
}) {
  const rows = await rpc<FeedPost[]>('feed_page', {
    p_mode: params.mode,
    p_place_key: params.placeKey ?? null,
    p_user: params.userId ?? null,
    p_before: params.mode === 'trending' ? null : params.before ?? null,
    p_limit: params.limit ?? 20,
    p_offset: params.mode === 'trending' ? params.offset ?? 0 : 0,
  });
  return (rows ?? []).map(normalize);
}

export async function getPost(id: string): Promise<FeedPost | null> {
  const rows = await rpc<FeedPost[]>('feed_page', { p_mode: 'post', p_post: id, p_limit: 1 });
  return rows?.[0] ? normalize(rows[0]) : null;
}

export type NewPost = {
  body: string;
  kind?: 'moment' | 'trip' | 'milestone';
  photos?: { uri: string; width?: number; height?: number }[];
  placeName?: string | null;
  placeKey?: string | null;
  tripId?: string | null;
  includeRoute?: boolean;
  visibility?: 'public' | 'followers';
  stats?: Record<string, number | string> | null;
};

export async function createPost(input: NewPost) {
  const check = screenText(input.body);
  if (!check.ok) throw new CommunityError(check.reason);
  const me = await currentUserId();
  const media: PostMedia[] = [];
  for (const photo of (input.photos ?? []).slice(0, 10)) {
    const img = await prepareImage(photo.uri, 1600, 0.82, photo);
    const path = `${me}/${uuid()}.jpg`;
    await uploadFile({ bucket: POST_MEDIA_BUCKET, path, localUri: img.uri, contentType: 'image/jpeg' });
    media.push({ path, width: img.width, height: img.height });
  }
  const { data, error } = await db()
    .from('posts')
    .insert({
      user_id: me,
      kind: input.kind ?? 'moment',
      body: input.body.trim() || null,
      media,
      place_name: input.placeName?.trim() || null,
      place_key: input.placeKey || null,
      trip_id: input.tripId ?? null,
      include_route: !!input.includeRoute && !!input.tripId,
      visibility: input.visibility ?? 'public',
      stats: input.stats ?? null,
    })
    .select('id')
    .single();
  if (error) throw new CommunityError(friendly(error));
  return data.id as string;
}

export async function deletePost(post: Pick<FeedPost, 'id' | 'media'>) {
  const { error } = await db().from('posts').delete().eq('id', post.id);
  if (error) throw new CommunityError(friendly(error));
  const paths = post.media.map(m => m.path);
  if (paths.length) await db().storage.from(POST_MEDIA_BUCKET).remove(paths).catch(() => undefined);
}

export async function setLiked(postId: string, liked: boolean) {
  const me = await currentUserId();
  if (liked) {
    const { error } = await db().from('post_likes').insert({ post_id: postId, user_id: me });
    if (error && !/duplicate key/i.test(error.message)) throw new CommunityError(friendly(error));
  } else {
    const { error } = await db().from('post_likes').delete().eq('post_id', postId).eq('user_id', me);
    if (error) throw new CommunityError(friendly(error));
  }
}

export async function listComments(postId: string) {
  return rpc<PostComment[]>('post_comments_page', { p_post: postId, p_limit: 200 });
}

export async function addComment(postId: string, body: string) {
  const check = screenText(body);
  if (!check.ok) throw new CommunityError(check.reason);
  const me = await currentUserId();
  const { error } = await db().from('post_comments').insert({ post_id: postId, user_id: me, body: body.trim() });
  if (error) throw new CommunityError(friendly(error));
}

export async function deleteComment(commentId: string) {
  const { error } = await db().from('post_comments').delete().eq('id', commentId);
  if (error) throw new CommunityError(friendly(error));
}
