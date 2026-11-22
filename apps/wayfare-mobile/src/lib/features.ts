// Product switches. Social features (public feed, travellers, chat, follows, place rooms) are built but
// switched off while Wayfare launches as a private travel journal. Turn them back on with
// EXPO_PUBLIC_WAYFARE_SOCIAL=1 in the build environment; nothing was deleted.
export const SOCIAL_ENABLED = process.env.EXPO_PUBLIC_WAYFARE_SOCIAL === '1';

/** First path segments of screens that only exist for the social side. */
export const SOCIAL_ROUTES = new Set(['discover', 'connect', 'inbox', 'post', 'user', 'follows', 'search', 'chat', 'join', 'board', 'place', 'guidelines', 'blocked']);

/** True when a route (as segments from useSegments) is a social screen that is switched off. */
export function isHiddenSocialRoute(segments: readonly string[]): boolean {
  if (SOCIAL_ENABLED) return false;
  const first = segments[0] === '(tabs)' ? segments[1] : segments[0];
  return Boolean(first && SOCIAL_ROUTES.has(first));
}
