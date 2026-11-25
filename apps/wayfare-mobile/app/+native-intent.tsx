import { safeSystemPath } from '../src/lib/safeLink';

/** Links from outside the app: one that can't be read safely opens the home screen. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return safeSystemPath(path);
  } catch {
    return '/';
  }
}
