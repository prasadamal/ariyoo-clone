/**
 * Reads what Supabase put on a password-reset link when it opened the app, e.g.
 *   wayfare://reset-password#access_token=…&refresh_token=…&type=recovery
 *   wayfare://reset-password#error=access_denied&error_code=otp_expired&error_description=…
 *   wayfare://reset-password?code=…            (PKCE flow)
 */
export type AuthRedirect =
  | { kind: 'tokens'; accessToken: string; refreshToken: string; type: string | null }
  | { kind: 'code'; code: string }
  | { kind: 'error'; code: string; message: string }
  | { kind: 'none' };

function params(part: string) {
  const out = new Map<string, string>();
  for (const pair of part.split('&')) {
    if (!pair) continue;
    const [k, ...rest] = pair.split('=');
    try {
      out.set(decodeURIComponent(k), decodeURIComponent(rest.join('=').replace(/\+/g, ' ')));
    } catch {
      out.set(k, rest.join('='));
    }
  }
  return out;
}

export function parseAuthRedirect(url: string | null | undefined): AuthRedirect {
  if (!url) return { kind: 'none' };
  const hashAt = url.indexOf('#');
  const queryAt = url.indexOf('?');
  const query = queryAt >= 0 ? url.slice(queryAt + 1, hashAt > queryAt ? hashAt : undefined) : '';
  const hash = hashAt >= 0 ? url.slice(hashAt + 1) : '';
  const all = new Map([...params(query), ...params(hash)]);
  const error = all.get('error_code') || all.get('error');
  if (error) return { kind: 'error', code: error, message: friendlyLinkError(error, all.get('error_description')) };
  const accessToken = all.get('access_token');
  const refreshToken = all.get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'tokens', accessToken, refreshToken, type: all.get('type') ?? null };
  const code = all.get('code');
  if (code) return { kind: 'code', code };
  return { kind: 'none' };
}

export function friendlyLinkError(code: string, description?: string) {
  if (code === 'otp_expired' || /expired|invalid/i.test(description ?? ''))
    return 'This reset link has expired or was already used. Ask for a new one below.';
  return 'This reset link didn’t work. Ask for a new one below.';
}

/** Same rule as sign-up. Returns the problem to show, or null when the password is fine. */
export function newPasswordProblem(password: string, confirm: string): string | null {
  if (password.length < 8) return `${8 - password.length} more character${8 - password.length === 1 ? '' : 's'} needed`;
  if (confirm && confirm !== password) return 'Passwords don’t match';
  if (!confirm) return 'Type the new password again';
  return null;
}
