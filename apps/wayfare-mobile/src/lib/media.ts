import { isSupabaseConfigured } from '../config';
import { uuid } from './id';
import { persistFile, prepareImage, signedUrl, uploadFile } from './upload';

export const ENTRY_MEDIA_BUCKET = 'entry-media';

export function buildStoragePath(userId: string, tripId: string, mediaId: string, ext: string) {
  return `${userId}/${tripId}/${mediaId}.${ext}`;
}

export function guessExt(uri: string, mimeType?: string | null) {
  if (mimeType?.includes('audio') || mimeType?.includes('m4a')) return 'm4a';
  if (mimeType?.includes('png')) return 'png';
  if (mimeType?.includes('webp')) return 'webp';
  if (mimeType?.includes('heic')) return 'heic';
  if (uri.toLowerCase().endsWith('.png')) return 'png';
  return 'jpg';
}

export function isAudio(mimeType: string | null | undefined) {
  return (mimeType ?? '').startsWith('audio');
}

/** Compresses a picked photo and stores it durably for the journal. */
export async function persistJournalPhoto(uri: string, mediaId: string, size?: { width?: number; height?: number }) {
  const prepared = await prepareImage(uri, 1600, 0.72, size);
  const stored = await persistFile(prepared.uri, 'journal', `${mediaId}.jpg`);
  return { uri: stored, mimeType: prepared.mimeType, width: prepared.width, height: prepared.height };
}

/** A journey's cover photo, resized and kept in the app's own storage (on this phone only). */
export async function persistCoverPhoto(uri: string, size?: { width?: number; height?: number }) {
  const prepared = await prepareImage(uri, 1400, 0.75, size);
  return persistFile(prepared.uri, 'covers', `${uuid()}.jpg`);
}

/** Moves a voice recording out of the cache directory. */
export async function persistVoiceNote(uri: string, mediaId: string) {
  return persistFile(uri, 'voice', `${mediaId}.m4a`);
}

/** Uploads a journal photo or voice note; returns its storage path. */
export async function uploadEntryMedia(params: {
  userId: string;
  tripId: string;
  mediaId: string;
  localUri: string;
  mimeType?: string | null;
}): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const ext = guessExt(params.localUri, params.mimeType);
  const path = buildStoragePath(params.userId, params.tripId, params.mediaId, ext);
  const contentType =
    params.mimeType ??
    (ext === 'm4a' ? 'audio/m4a' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
  return uploadFile({ bucket: ENTRY_MEDIA_BUCKET, path, localUri: params.localUri, contentType });
}

/** Playable / viewable URI: the local file when present, else a signed cloud URL. */
export async function resolveMediaUri(media: { local_uri: string; storage_path: string | null }) {
  if (media.local_uri) return media.local_uri;
  if (media.storage_path) return signedUrl(ENTRY_MEDIA_BUCKET, media.storage_path);
  return null;
}

/** @deprecated use resolveMediaUri */
export async function getSignedPhotoUrl(storagePath: string, expiresIn = 3600) {
  return signedUrl(ENTRY_MEDIA_BUCKET, storagePath, expiresIn);
}
