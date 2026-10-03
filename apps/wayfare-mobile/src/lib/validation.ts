/** Pure input validation helpers (unit tested). */

export const LIMITS = {
  title: 120,
  destination: 120,
  companions: 300,
  notes: 5000,
  entryBody: 20000,
  place: 120,
  note: 300,
  label: 120,
  displayName: 60,
} as const;

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export type TripFormInput = {
  title: string;
  destination: string;
  startsOn: string;
  endsOn: string;
  companions: string;
  notes: string;
};

/** Returns a user-facing error, or null when the form is valid. */
export function validateTripForm(f: TripFormInput): string | null {
  if (!f.title.trim()) return 'Give your trip a title.';
  if (f.title.trim().length > LIMITS.title) return `Title must be ${LIMITS.title} characters or fewer.`;
  if (f.destination.length > LIMITS.destination) return 'Destination is too long.';
  if (f.companions.length > LIMITS.companions) return 'Companions is too long.';
  if (f.notes.length > LIMITS.notes) return 'Notes are too long.';
  if (f.startsOn && !isValidIsoDate(f.startsOn)) return 'Start date must look like 2026-12-31.';
  if (f.endsOn && !isValidIsoDate(f.endsOn)) return 'End date must look like 2026-12-31.';
  if (f.startsOn && f.endsOn && f.endsOn < f.startsOn) return 'End date must be on or after the start date.';
  return null;
}

/** Parses "1,250.50" / "1250" style input. Returns null if not a positive finite amount. */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0 || n >= 1_000_000_000) return null;
  return Math.round(n * 100) / 100;
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Include at least one letter and one number.';
  return null;
}

/** Share ids must be unguessable; mirrors the DB check (>= 20 chars). */
export function isValidShareId(id: string): boolean {
  return /^[A-Za-z0-9-]{20,100}$/.test(id);
}
