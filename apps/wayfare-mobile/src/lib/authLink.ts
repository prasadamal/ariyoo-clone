/** Parses Supabase auth redirect URLs (email confirm / password recovery). Pure + unit tested. */
export type AuthLink = {
  type: 'recovery' | 'signup' | 'magiclink' | 'invite' | 'email_change' | 'unknown';
  accessToken?: string;
  refreshToken?: string;
  code?: string;
  error?: string;
};

export function parseAuthUrl(url: string): AuthLink | null {
  if (!url) return null;
  const hashIdx = url.indexOf('#');
  const queryIdx = url.indexOf('?');
  const hash = hashIdx >= 0 ? url.slice(hashIdx + 1) : '';
  const query = queryIdx >= 0 ? url.slice(queryIdx + 1, hashIdx >= 0 && hashIdx > queryIdx ? hashIdx : undefined) : '';
  const params = new URLSearchParams(hash);
  new URLSearchParams(query).forEach((v, k) => {
    if (!params.has(k)) params.set(k, v);
  });
  if (![...params.keys()].length) return null;

  const rawType = params.get('type') ?? '';
  const known = ['recovery', 'signup', 'magiclink', 'invite', 'email_change'];
  return {
    type: (known.includes(rawType) ? rawType : 'unknown') as AuthLink['type'],
    accessToken: params.get('access_token') ?? undefined,
    refreshToken: params.get('refresh_token') ?? undefined,
    code: params.get('code') ?? undefined,
    error: params.get('error_description') ?? params.get('error') ?? undefined,
  };
}
