/**
 * App lock hand-offs (pure): while Wayfare itself has opened the camera or a photo picker, leaving
 * the app is not "going away", so the lock must not close the screen underneath. Also a short
 * grace for quick trips out (a share sheet, the UPI app): only an absence longer than that locks.
 */
let holds = 0;

/** Runs `fn` (which opens system UI) with the lock held; released a moment after it returns. */
export async function holdLock<T>(fn: () => Promise<T>): Promise<T> {
  holds += 1;
  try {
    return await fn();
  } finally {
    // The app becomes active again just before the picker's promise settles; keep the hold a beat longer.
    setTimeout(() => {
      holds = Math.max(0, holds - 1);
    }, 1500);
  }
}

export const isLockHeld = () => holds > 0;

/** Away this long (ms) before the lock asks again. */
export const LOCK_GRACE_MS = 30_000;

/** Whether coming back to the app should ask to unlock. */
export function shouldLockOnReturn(awayMs: number, heldWhenLeft: boolean): boolean {
  if (heldWhenLeft) return false;
  return awayMs >= LOCK_GRACE_MS;
}
