/**
 * One answer to "is my journal safely backed up?", shared by Settings, Home and the sign-out dialog.
 * "verified" only when the last sync finished cleanly AND we positively counted zero waiting changes.
 * An unknown count, a failed sync or no sync yet is never reported as backed up.
 */
export type BackupState = 'syncing' | 'error' | 'waiting' | 'unknown' | 'verified' | 'unverified';

export type BackupInput = {
  syncing: boolean;
  errors: string[];
  /** Changes not yet uploaded; null when they couldn't be counted. */
  pending: number | null;
  lastSyncAt: string | null;
};

export function backupState(i: BackupInput): BackupState {
  if (i.syncing) return 'syncing';
  if (i.errors.length) return 'error';
  if (i.pending == null) return 'unknown';
  if (i.pending > 0) return 'waiting';
  return i.lastSyncAt ? 'verified' : 'unverified';
}

export function backupLabel(i: BackupInput): string {
  switch (backupState(i)) {
    case 'syncing': return 'Syncing…';
    case 'error': return 'Backup needs attention — try syncing again';
    case 'unknown': return 'Backup status unknown — try syncing again';
    case 'waiting': return `${i.pending} change${i.pending === 1 ? '' : 's'} waiting to sync`;
    case 'verified': return 'Everything is backed up';
    default: return 'Backup has not been verified yet';
  }
}

/** Text for the sign-out dialog. Only a verified backup is described as safe. */
export function signOutMessage(i: BackupInput): string {
  const state = backupState(i);
  if (state === 'verified') return 'Your journals are backed up to your account.';
  if (state === 'waiting')
    return `${i.pending} change${i.pending === 1 ? ' has' : 's have'} not synced yet. Keep your journals on this phone, or sync first.`;
  if (state === 'syncing') return 'A backup is still running. Keep your journals on this phone, or wait for it to finish.';
  return 'We couldn’t confirm your journals are backed up. Keep them on this phone, or sync first.';
}
