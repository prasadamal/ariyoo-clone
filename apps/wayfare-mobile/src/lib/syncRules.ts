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
