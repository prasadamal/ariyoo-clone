/** Last-writer-wins rule for pulls (pure). */

/** Remote wins only when strictly newer and the local copy has no unsynced edits. */
export function shouldApplyRemote(
  local: { sync_status: string; updated_at: string } | null,
  remoteUpdatedAt: string | null | undefined
) {
  if (!local) return true;
  if (local.sync_status === 'pending') return false;
  if (!remoteUpdatedAt) return false;
  return new Date(remoteUpdatedAt).getTime() > new Date(local.updated_at).getTime();
}

/**
 * May a pull delete local synced rows that the cloud no longer has?
 * A non-empty result is always trustworthy. An empty one is trusted only when this same sync proved
 * the account can read its own data (a signed-out or expired session can also return "nothing"),
 * so deleting the last expense on one phone now removes it from the other phone too.
 */
export function mayReconcile(remoteCount: number, accessVerified: boolean) {
  return remoteCount > 0 || accessVerified;
}
