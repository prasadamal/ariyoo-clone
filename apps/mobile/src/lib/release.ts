/** Pure helpers shared by the app config, the app itself and the release preflight. */

const PLACEHOLDER = /YOUR_|REPLACE_WITH_|example\.(com|org)|^00000000-/i;

/** A configured value, or undefined when blank or still a documentation placeholder. */
export function envValue(value: string | null | undefined): string | undefined {
  const v = value?.trim();
  if (!v || PLACEHOLDER.test(v)) return undefined;
  return v;
}

/** A usable API base URL without a trailing slash, or undefined. */
export function apiBase(value: string | null | undefined): string | undefined {
  const v = envValue(value);
  if (!v || !/^https?:\/\/[^\s/]+/.test(v)) return undefined;
  return v.replace(/\/+$/, '');
}

export type ReleaseInputs = {
  env: Record<string, string | undefined>;
  eas: { submit?: { production?: { ios?: Record<string, string | undefined> } } };
  easProjectId: string;
  hasGoogleServices: boolean;
};
export type ReleaseProblem = { level: 'error' | 'warning'; message: string };

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

/** Everything a store build needs that nothing else would complain about. */
export function checkRelease(i: ReleaseInputs): ReleaseProblem[] {
  const problems: ReleaseProblem[] = [];
  const error = (message: string) => problems.push({ level: 'error', message });
  const warning = (message: string) => problems.push({ level: 'warning', message });

  if (!UUID.test(i.easProjectId) || !envValue(i.easProjectId)) {
    error('EAS project id is missing. Run `eas init` and paste the id into app.config.ts (store/EAS_SECRETS.md).');
  }
  const api = apiBase(i.env.EXPO_PUBLIC_API_URL);
  if (!api) {
    error('EXPO_PUBLIC_API_URL is not set: the app would open on a "not connected" screen.');
  } else if (!api.startsWith('https://') || /localhost|127\.0\.0\.1|10\.0\.2\.2/.test(api)) {
    error('EXPO_PUBLIC_API_URL must be a public https address (store builds block plain http).');
  }
  const ios = i.eas.submit?.production?.ios ?? {};
  if (['appleId', 'ascAppId', 'appleTeamId'].some(k => !envValue(ios[k]))) {
    warning('eas.json → submit.production.ios still has placeholders: `eas submit` for iOS will ask for them or fail.');
  }
  if (!i.hasGoogleServices) {
    warning('No google-services.json: Android builds will not receive push notifications.');
  }
  return problems;
}
