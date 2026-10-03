import { supabase } from './supabase';
import { isSupabaseConfigured } from '../config';

const BUCKET = 'entry-media';

export function buildStoragePath(userId: string, tripId: string, mediaId: string, ext: string) {
  return `${userId}/${tripId}/${mediaId}.${ext}`;
}

export function guessExt(uri: string, mimeType?: string | null) {
  if (mimeType?.includes('audio') || mimeType?.includes('m4a')) return 'm4a';
  if (mimeType?.includes('png')) return 'png';
  if (mimeType?.includes('webp')) return 'webp';
  if (mimeType?.includes('heic')) return 'heic';
  if (uri.toLowerCase().includes('.png')) return 'png';
  return 'jpg';
}

/** Upload a local file URI to Supabase Storage; returns storage path. */
export async function uploadEntryPhoto(params: {
  userId: string;
  tripId: string;
  entryId: string;
  mediaId: string;
  localUri: string;
  mimeType?: string | null;
}): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured');
  }
  const ext = guessExt(params.localUri, params.mimeType);
  const path = buildStoragePath(params.userId, params.tripId, params.mediaId, ext);
  const response = await fetch(params.localUri);
  const bytes = await response.arrayBuffer();
  const contentType =
    params.mimeType ??
    (ext === 'm4a'
      ? 'audio/mp4'
      : ext === 'png'
        ? 'image/png'
        : ext === 'webp'
          ? 'image/webp'
          : 'image/jpeg');

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export async function getSignedPhotoUrl(storagePath: string, expiresIn = 3600) {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn);
  if (error) return null;
  return data.signedUrl;
}
