/**
 * When a photo was taken, from the details the camera wrote into it (EXIF). Pure: unit-tested.
 * A moment made from photos takes the time of its earliest photo, so a picture from yesterday's
 * hike lands on yesterday's page.
 */

type Exif = Record<string, unknown> | null | undefined;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * "2026:03:12 09:14:33" (the phone's local time, plus "+05:30" when the camera saved the offset)
 * → an ISO time. Null when missing, broken, before 1990, or in the future.
 */
export function exifTakenAt(exif: Exif, now = new Date()): string | null {
  if (!exif) return null;
  const raw = exif.DateTimeOriginal ?? exif.DateTimeDigitized ?? exif.DateTime;
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4], m[5]].map(Number);
  const s = m[6] ? Number(m[6]) : 0;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const offset = exif.OffsetTimeOriginal ?? exif.OffsetTime;
  let date: Date;
  if (typeof offset === 'string' && /^[+-]\d{2}:\d{2}$/.test(offset.trim())) {
    date = new Date(`${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}${offset.trim()}`);
  } else {
    date = new Date(y, mo - 1, d, h, mi, s);
    // 31 Feb and the like roll over: not a real date.
    if (date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  }
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 1990) return null;
  // A few minutes ahead is a clock difference; more is a wrong camera clock.
  if (date.getTime() > now.getTime() + 5 * 60_000) return null;
  return date.toISOString();
}

/** The moment's time from its photos: the earliest one taken (null when none say). */
export function earliestTakenAt(times: readonly (string | null | undefined)[]): string | null {
  const valid = times.filter((t): t is string => typeof t === 'string' && t.length > 0).sort();
  return valid[0] ?? null;
}
