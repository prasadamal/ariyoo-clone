/** RFC4122 v4 id. Prefers the platform's secure RNG; falls back to expo-crypto. */
export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('expo-crypto') as typeof import('expo-crypto')).randomUUID();
}

/** Long, unguessable id for public share links (the DB requires >= 20 chars). */
export function newShareId(): string {
  return `${newId()}${newId()}`.replace(/-/g, '');
}
