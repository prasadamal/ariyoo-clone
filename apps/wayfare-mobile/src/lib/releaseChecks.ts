import { envValue, isUsableSupabaseConfig } from './envValue';

/**
 * Checks that a store build is fully wired up (pure; `scripts/preflight.cjs` feeds it real values).
 * A build without these still runs — as an offline journal — which is exactly why it has to be
 * checked on purpose: nothing fails loudly when a value is forgotten.
 */

export type ReleaseInputs = {
  env: Record<string, string | undefined>;
  /** Parsed eas.json. */
  eas: { submit?: { production?: { ios?: Record<string, string | undefined> } } };
  /** Text of docs/wayfare-config.js (the web viewers' config). */
  webConfig: string;
  /** True when apps/wayfare-mobile/google-services.json exists or GOOGLE_SERVICES_JSON is set. */
  hasGoogleServices: boolean;
  /** The easProjectId constant resolved by app.config.ts. */
  easProjectId: string;
};

export type ReleaseProblem = { level: 'error' | 'warning'; message: string };

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function host(url: string | undefined) {
  try {
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
}

export function checkRelease(i: ReleaseInputs): ReleaseProblem[] {
  const problems: ReleaseProblem[] = [];
  const error = (message: string) => problems.push({ level: 'error', message });
  const warning = (message: string) => problems.push({ level: 'warning', message });

  if (!UUID.test(i.easProjectId)) {
    error('EAS project id is missing. Run `eas init` and paste the id into app.config.ts (store/EAS_SECRETS.md §1).');
  }

  const url = envValue(i.env.EXPO_PUBLIC_SUPABASE_URL) ?? '';
  const key = envValue(i.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) ?? '';
  if (!isUsableSupabaseConfig(url, key)) {
    error('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set: the build would ship without accounts, sync or community.');
  } else if (!url.startsWith('https://')) {
    error('EXPO_PUBLIC_SUPABASE_URL must use https.');
  }

  const webUrl = /supabaseUrl:\s*'([^']*)'/.exec(i.webConfig)?.[1];
  const webKey = /supabaseAnonKey:\s*'([^']*)'/.exec(i.webConfig)?.[1];
  if (!envValue(webUrl) || !envValue(webKey)) {
    error('docs/wayfare-config.js still has placeholders: shared-journey and live-location links would open a broken page.');
  } else if (url && host(webUrl) !== host(url)) {
    error('docs/wayfare-config.js points at a different Supabase project than the app build.');
  }

  for (const name of ['EXPO_PUBLIC_WAYFARE_SHARE_BASE', 'EXPO_PUBLIC_WAYFARE_LIVE_BASE']) {
    const value = i.env[name];
    if (value && (!envValue(value) || !value.startsWith('https://'))) error(`${name} must be an https URL (or unset to use the ariyoo-docs pages).`);
  }

  const ios = i.eas.submit?.production?.ios ?? {};
  if (['appleId', 'ascAppId', 'appleTeamId'].some(k => !envValue(ios[k]))) {
    warning('eas.json → submit.production.ios still has placeholders: `eas submit` for iOS will ask for them or fail.');
  }
  if (!i.hasGoogleServices) {
    warning('No google-services.json: Android builds will not receive push notifications (local reminders still work).');
  }
  return problems;
}
