/** Builds the SMS text sent to emergency contacts (pure). */

export type SosInput = {
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyM?: number | null;
  altitudeM?: number | null;
  at: Date;
  /** When the location fix was taken. Older than a couple of minutes = a last-known position, said so. */
  fixAt?: Date | null;
  tripTitle?: string | null;
  liveUrl?: string | null;
  note?: string | null;
};

/**
 * Time as the sender's phone shows it, with the time zone. The person reading the SMS is often in
 * another country, so "14:05" on its own could be hours out.
 */
export function stampTime(at: Date) {
  const base = { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' } as const;
  try {
    return at.toLocaleString('en-IN', { ...base, timeZoneName: 'short' });
  } catch {
    // Older JS engines without time-zone names: fall back to UTC, labelled as such.
    return `${at.toLocaleString('en-IN', { ...base, timeZone: 'UTC' })} UTC`;
  }
}

export function mapsLink(latitude: number, longitude: number) {
  return `https://maps.google.com/?q=${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

/** "12 min", "3 h", "2 days": how old a location fix is, in a few characters. */
export function fixAge(fixAt: Date, now: Date) {
  const min = Math.max(0, Math.round((now.getTime() - fixAt.getTime()) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} days`;
}

/** A fix older than this is a last-known position, not "where I am now". */
export const STALE_FIX_MS = 2 * 60 * 1000;

export function buildSosMessage(i: SosInput) {
  const who = i.name?.trim() || 'your contact';
  const when = stampTime(i.at);
  const lines = [`SOS from ${who} via Wayfare. I may need help.`];
  if (i.latitude != null && i.longitude != null) {
    const acc = i.accuracyM != null ? ` (±${Math.round(i.accuracyM)} m)` : '';
    const alt = i.altitudeM != null ? `, altitude ~${Math.round(i.altitudeM)} m` : '';
    const stale = i.fixAt != null && i.at.getTime() - i.fixAt.getTime() > STALE_FIX_MS;
    const label = stale
      ? `Last known location, from ${fixAge(i.fixAt!, i.at)} ago (${stampTime(i.fixAt!)}); no current fix at ${when}`
      : `Location at ${i.fixAt ? stampTime(i.fixAt) : when}`;
    lines.push(`${label}: ${i.latitude.toFixed(5)}, ${i.longitude.toFixed(5)}${acc}${alt}`);
    lines.push(`Map: ${mapsLink(i.latitude, i.longitude)}`);
  } else {
    lines.push(`Location unavailable at ${when} — please call me.`);
  }
  if (i.liveUrl) lines.push(`Live location: ${i.liveUrl}`);
  if (i.tripTitle) lines.push(`Trip: ${i.tripTitle}`);
  if (i.note?.trim()) lines.push(`Note: ${i.note.trim()}`);
  return lines.join('\n');
}

export function buildCheckInMessage(name: string | null, place: string | null, at: Date) {
  const when = stampTime(at);
  return `${name?.trim() || 'I'} checked in safe via Wayfare at ${when}${place ? ` near ${place}` : ''}. ✅`;
}
