import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatDateRange } from './format';
import { listEntries, listTripMedia, type LocalTrip } from './localDb';
import { isAudio, resolveMediaUri } from './media';
import { buildPhotoBookHtml, type BookPage } from './photoBookHtml';
import { stripRich } from './richText';
import { tripCoverUri } from './tripCover';

/** Keeps the book printable on a phone: at most this many photos, each shrunk for print. */
const MAX_PHOTOS = 40;

/** A local photo as print-ready data (smaller copy), or a web address for photos only in the cloud. */
async function printable(uri: string): Promise<string | null> {
  if (/^https:\/\//.test(uri)) return uri;
  try {
    const ctx = ImageManipulator.manipulate(uri);
    ctx.resize({ width: 1400 });
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
    img.release();
    ctx.release();
    if (out.base64) return `data:image/jpeg;base64,${out.base64}`;
    const b64 = await FileSystem.readAsStringAsync(out.uri, { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/jpeg;base64,${b64}`;
  } catch {
    return null;
  }
}

/** Builds the journey's photo book as a PDF and opens the share sheet (save, print or send it). */
export async function exportPhotoBook(trip: LocalTrip) {
  const [entries, media, coverUri] = await Promise.all([listEntries(trip.id), listTripMedia(trip.id), tripCoverUri(trip).catch(() => null)]);
  const photos = media.filter(m => !isAudio(m.mime_type)).slice(0, MAX_PHOTOS);
  const byEntry = new Map<string, string[]>();
  for (const m of photos) {
    const uri = await resolveMediaUri(m).catch(() => null);
    const src = uri ? await printable(uri) : null;
    if (src) byEntry.set(m.entry_id, [...(byEntry.get(m.entry_id) ?? []), src]);
  }
  const pages: BookPage[] = entries
    .filter(e => byEntry.has(e.id))
    .map(e => ({
      date: new Date(e.recorded_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
      caption: e.body && e.body !== '📷' ? stripRich(e.body).slice(0, 400) : '',
      images: byEntry.get(e.id) ?? [],
    }));
  const cover = coverUri ? await printable(coverUri) : null;
  const html = buildPhotoBookHtml({ title: trip.title, subtitle: [trip.destination, formatDateRange(trip.starts_on, trip.ends_on)].filter(Boolean).join(' · '), cover, pages });
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${trip.title} photo book`, UTI: 'com.adobe.pdf' });
}
