/**
 * A link opened from outside the app (a shared link, a notification) that Wayfare can't read
 * safely goes to the home screen instead of an error screen: broken %-codes, or absurdly long.
 * Pure, for tests; used by app/+native-intent.tsx.
 */
export function safeSystemPath(path: string): string {
  if (!path || path.length > 2048) return '/';
  try {
    // Every part must decode; expo-router decodes them and would throw on a broken one.
    const [pathname, query = ''] = path.split('?');
    pathname.split('/').forEach(part => decodeURIComponent(part));
    query.split(/[&=]/).forEach(part => decodeURIComponent(part.replace(/\+/g, ' ')));
    return path;
  } catch {
    return '/';
  }
}
