// Placeholders from `.env.example` / the setup docs. A build that still carries one behaves as if
// the value were unset (offline journal) instead of calling a URL that does not exist.
const PLACEHOLDER = /YOUR_PROJECT|^YOUR_[A-Z_]+$|^your-[a-z-]+$|REPLACE_WITH_/;

/** A configured value, or undefined when it is blank or still a documentation placeholder. */
export function envValue(value: string | null | undefined): string | undefined {
  const v = value?.trim();
  if (!v || PLACEHOLDER.test(v)) return undefined;
  return v;
}

/** True when the Supabase URL and anon key look like a real project. */
export function isUsableSupabaseConfig(url: string, anonKey: string): boolean {
  return /^https?:\/\/[^\s/]+/.test(url) && anonKey.length > 0;
}
