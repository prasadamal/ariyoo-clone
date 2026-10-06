import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabaseAnonKey, supabaseUrl } from '../config';
import { supabase } from './supabase';

export type PreparedImage = { uri: string; width: number; height: number; mimeType: 'image/jpeg' };

/**
 * Resizes (long edge ≤ maxEdge) and re-encodes to JPEG: HEIC-safe and upload-friendly.
 * Pass the picker's width/height when known to skip a decode.
 */
export async function prepareImage(
  uri: string,
  maxEdge = 2048,
  quality = 0.8,
  size?: { width?: number; height?: number }
): Promise<PreparedImage> {
  const context = ImageManipulator.manipulate(uri);
  try {
    let width = size?.width ?? 0;
    let height = size?.height ?? 0;
    if (!width || !height) {
      const probeContext = ImageManipulator.manipulate(uri);
      const probe = await probeContext.renderAsync();
      width = probe.width;
      height = probe.height;
      probe.release();
      probeContext.release();
    }
    if (Math.max(width, height) > maxEdge) context.resize(width >= height ? { width: maxEdge } : { height: maxEdge });
    const image = await context.renderAsync();
    const out = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
    image.release();
    return { uri: out.uri, width: out.width, height: out.height, mimeType: 'image/jpeg' };
  } finally {
    context.release();
  }
}

/** Copies a cache file (picker / recorder output) into durable app storage. */
export async function persistFile(uri: string, folder: string, fileName: string) {
  const dir = `${FileSystem.documentDirectory}${folder}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
  const dest = `${dir}${fileName}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

/** Streams a local file to Supabase Storage (no base64 / ArrayBuffer in JS memory). */
export async function uploadFile(params: {
  bucket: string;
  path: string;
  localUri: string;
  contentType: string;
  upsert?: boolean;
}) {
  if (!supabase) throw new Error('Cloud is not configured');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in to upload');
  const info = await FileSystem.getInfoAsync(params.localUri);
  if (!info.exists) throw new Error('File is no longer on this device');
  const url = `${supabaseUrl}/storage/v1/object/${params.bucket}/${params.path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
  const res = await FileSystem.uploadAsync(url, params.localUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
      'Content-Type': params.contentType,
      'x-upsert': params.upsert === false ? 'false' : 'true',
      'cache-control': '3600',
    },
  });
  if (res.status < 200 || res.status >= 300) {
    let message = `Upload failed (${res.status})`;
    try {
      const body = JSON.parse(res.body);
      message = body.message || body.error || message;
    } catch {
      // keep generic message
    }
    throw new Error(message);
  }
  return params.path;
}

export function publicUrl(bucket: string, path: string | null | undefined) {
  if (!path || !supabase) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

const signedCache = new Map<string, { url: string; expires: number }>();

/** Signed URL for private buckets, cached for most of its lifetime. */
export async function signedUrl(bucket: string, path: string, expiresIn = 3600) {
  if (!supabase) return null;
  const key = `${bucket}/${path}`;
  const hit = signedCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  signedCache.set(key, { url: data.signedUrl, expires: Date.now() + (expiresIn - 300) * 1000 });
  return data.signedUrl;
}
