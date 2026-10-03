/** Pure helpers for media naming / MIME handling (unit tested). */

export const MAX_MEDIA_BYTES = 25 * 1024 * 1024; // keep in sync with the bucket limit

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;
const AUDIO_MIMES = ['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/mpeg', 'audio/aac'] as const;

export type MediaKind = 'photo' | 'audio';

export function kindForMime(mime: string | null | undefined): MediaKind {
  return (mime ?? '').toLowerCase().startsWith('audio/') ? 'audio' : 'photo';
}

/** Maps picker/recorder output to a MIME type the cloud bucket accepts. */
export function normalizeMime(mime: string | null | undefined, uri: string, kind: MediaKind): string {
  const m = (mime ?? '').toLowerCase().split(';')[0].trim();
  if (kind === 'audio') {
    if ((AUDIO_MIMES as readonly string[]).includes(m)) return m;
    if (uri.toLowerCase().endsWith('.mp3')) return 'audio/mpeg';
    if (uri.toLowerCase().endsWith('.aac')) return 'audio/aac';
    return 'audio/mp4'; // .m4a (AAC in MP4) is what both platforms record
  }
  if ((IMAGE_MIMES as readonly string[]).includes(m)) return m;
  if (m === 'image/jpg') return 'image/jpeg';
  const lower = uri.toLowerCase().split('?')[0];
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  return 'image/jpeg';
}

export function extForMime(mime: string): string {
  switch (mime) {
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'image/heic': return 'heic';
    case 'image/heif': return 'heif';
    case 'audio/mpeg': return 'mp3';
    case 'audio/aac': return 'aac';
    case 'audio/mp4':
    case 'audio/m4a':
    case 'audio/x-m4a': return 'm4a';
    default: return 'jpg';
  }
}

/** `<userId>/<tripId>/<mediaId>.<ext>` — the first folder must be the user id (storage RLS). */
export function buildStoragePath(userId: string, tripId: string, mediaId: string, mime: string): string {
  return `${userId}/${tripId}/${mediaId}.${extForMime(mime)}`;
}
