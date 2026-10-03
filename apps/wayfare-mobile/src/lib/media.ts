import { Directory, File, Paths } from 'expo-file-system';
import { isSupabaseConfigured } from '../config';
import { newId } from './id';
import { buildStoragePath, extForMime, MAX_MEDIA_BYTES } from './mediaTypes';
import { supabase } from './supabase';

export { buildStoragePath } from './mediaTypes';

const BUCKET = 'entry-media';

function mediaDir() {
  const dir = new Directory(Paths.document, 'media');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/**
 * Picker / recorder output lives in the OS cache, which can be purged at any time.
 * Copy it into the app's document directory so the user's memories stay on the device
 * until they are uploaded.
 */
export function persistLocalFile(srcUri: string, mime: string): { uri: string; size: number } {
  const src = new File(srcUri);
  const dest = new File(mediaDir(), `${newId()}.${extForMime(mime)}`);
  src.copy(dest);
  return { uri: dest.uri, size: dest.size ?? 0 };
}

export function deleteLocalFile(uri: string | null | undefined) {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // best effort
  }
}

export function deleteLocalFiles(uris: string[]) {
  uris.forEach(deleteLocalFile);
}

/** Uploads a local file; returns its storage path. */
export async function uploadMedia(params: {
  userId: string;
  tripId: string;
  mediaId: string;
  localUri: string;
  mime: string;
}): Promise<{ path: string; size: number }> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Cloud sync is not configured');
  const file = new File(params.localUri);
  if (!file.exists) throw new Error('The local file is missing');
  const size = file.size ?? 0;
  if (size > MAX_MEDIA_BYTES) throw new Error('File is larger than 25 MB');

  const path = buildStoragePath(params.userId, params.tripId, params.mediaId, params.mime);
  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: params.mime,
    upsert: true,
  });
  if (error) throw error;
  return { path, size };
}

export async function removeRemoteObjects(paths: string[]) {
  if (!supabase || !paths.length) return;
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (error) throw error;
  }
}

export async function getSignedMediaUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn);
  return error ? null : data.signedUrl;
}
