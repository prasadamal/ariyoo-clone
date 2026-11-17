/** Mirrors the server rules so people see the problem before the request is sent. */

export const MIN_PASSWORD = 12;

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  // bcrypt reads only the first 72 bytes; refuse longer ones rather than silently truncating.
  let bytes = 0;
  for (const ch of password) {
    const code = ch.codePointAt(0)!;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  if (bytes > 72) return 'Use at most 72 characters.';
  return null;
}

export function emailProblem(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) ? null : 'Enter a valid email address.';
}

/** Topics are stored lower-case; this is what an expert types turned into what gets saved. */
export function cleanTopic(raw: string): string | null {
  const t = raw.trim().replace(/^#+/, '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (t.length < 2 || t.length > 40) return null;
  // \p{M}: scripts such as Malayalam and Hindi write vowels as combining marks.
  return /^[\p{L}\p{N}][\p{L}\p{M}\p{N} &+.'-]*$/u.test(t) ? t : null;
}

/** Pulls #tags out of a question: "Best beaches #goa #beaches" → ["goa", "beaches"]. */
export function hashtags(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/#([\p{L}\p{N}][\p{L}\p{M}\p{N}_-]{1,39})/gu)) found.add(m[1].toLowerCase());
  return [...found];
}

/**
 * Size to scale a photo down to so its longer side is at most `max` pixels, or null when it is
 * already small enough (or its size is unknown). Chat photos are stored in a free-tier database,
 * so a phone's 12-megapixel original is shrunk before upload: about 200 KB instead of several MB.
 */
export function photoResizeTarget(width: number | undefined, height: number | undefined, max = 1280): { width: number } | { height: number } | null {
  if (!width || !height || Math.max(width, height) <= max) return null;
  return width >= height ? { width: max } : { height: max };
}
