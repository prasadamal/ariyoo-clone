/**
 * Whether a location reading can mark a moment as verified (pure; unit-tested): it must come from
 * the phone itself (Android flags fake-GPS apps as "mocked"), be recent, and be accurate enough to
 * name the place.
 */
export function trustedFix(fix: { mocked?: boolean | null; accuracy?: number | null; timestamp?: number | null }, now = Date.now()): boolean {
  if (fix.mocked) return false;
  if (fix.accuracy == null || !(fix.accuracy > 0) || fix.accuracy > 150) return false;
  if (fix.timestamp == null || now - fix.timestamp > 2 * 60_000 || fix.timestamp - now > 60_000) return false;
  return true;
}

/** A moment's place is verified when it kept the point (only trusted readings keep one). */
export function isVerifiedPlace(e: { latitude?: number | null; longitude?: number | null }): boolean {
  return e.latitude != null && e.longitude != null;
}
