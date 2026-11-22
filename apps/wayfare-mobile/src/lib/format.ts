/** Pure display helpers. */

export function timeAgo(iso: string | null | undefined, now: Date = new Date()) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.round(d / 7);
  if (d < 30) return `${w}w`;
  const date = new Date(then);
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** Parses YYYY-MM-DD as a local calendar date (not UTC midnight). */
export function parseDay(day: string | null | undefined): Date | null {
  if (!day) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDayString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDay(day: string | null | undefined, opts: { weekday?: boolean; year?: boolean } = {}) {
  const d = parseDay(day);
  if (!d) return '';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(opts.weekday ? { weekday: 'short' } : {}),
    ...(opts.year ? { year: 'numeric' } : {}),
  });
}

export function formatDateRange(start: string | null | undefined, end: string | null | undefined) {
  const s = parseDay(start);
  const e = parseDay(end);
  if (!s && !e) return '';
  if (s && !e) return `From ${formatDay(start, { year: true })}`;
  if (!s && e) return `Until ${formatDay(end, { year: true })}`;
  const sameYear = s!.getFullYear() === e!.getFullYear();
  const sameMonth = sameYear && s!.getMonth() === e!.getMonth();
  if (sameMonth) {
    if (s!.getDate() === e!.getDate()) return formatDay(start, { year: true });
    return `${s!.getDate()}–${e!.getDate()} ${s!.toLocaleDateString('en-IN', { month: 'short' })} ${s!.getFullYear()}`;
  }
  if (sameYear) return `${formatDay(start)} – ${formatDay(end)} ${s!.getFullYear()}`;
  return `${formatDay(start, { year: true })} – ${formatDay(end, { year: true })}`;
}

/** Inclusive day count of a trip (1 for a single day). */
export function dayCount(start: string | null | undefined, end: string | null | undefined) {
  const s = parseDay(start);
  const e = parseDay(end ?? start);
  if (!s || !e) return 0;
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
}

export type TripPhase = 'upcoming' | 'ongoing' | 'past' | 'undated';

export function tripPhase(start: string | null | undefined, end: string | null | undefined, today = new Date()) {
  const s = parseDay(start);
  if (!s) return 'undated' as TripPhase;
  const e = parseDay(end) ?? s;
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (t < s) return 'upcoming' as TripPhase;
  if (t > e) return 'past' as TripPhase;
  return 'ongoing' as TripPhase;
}

export function daysUntil(day: string | null | undefined, today = new Date()) {
  const d = parseDay(day);
  if (!d) return null;
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

export function formatKm(km: number) {
  if (km <= 0) return '0 km';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString('en-IN')} km`;
}

export function formatAltitude(m: number | null | undefined) {
  if (m == null) return '—';
  return `${Math.round(m).toLocaleString('en-IN')} m`;
}

export function compactNumber(n: number) {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (n < 1000000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
}

export function plural(n: number, singular: string, pluralForm = `${singular}s`) {
  return `${n.toLocaleString('en-IN')} ${n === 1 ? singular : pluralForm}`;
}

export function initials(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

/** Stable pleasant colour per id (avatars without photos). */
export function colorForId(id: string | null | undefined) {
  const palette = ['#6a01a3', '#0f766e', '#7c3aed', '#be123c', '#1d4ed8', '#a16207', '#047857', '#9333ea', '#0369a1'];
  let h = 0;
  for (const ch of id ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

export function displayName(p: { display_name?: string | null; username?: string | null } | null | undefined) {
  return p?.display_name?.trim() || (p?.username ? `@${p.username}` : 'Traveller');
}

export function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
