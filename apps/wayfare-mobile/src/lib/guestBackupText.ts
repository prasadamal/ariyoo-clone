/** What signing in does to journals kept on this phone without an account. Pure, for tests. */
export function guestBackupNotice(counts: { trips: number; entries: number }): string | null {
  if (counts.trips <= 0 && counts.entries <= 0) return null;
  const what =
    counts.trips > 1
      ? `The ${counts.trips} journeys on this phone, with their photos and voice notes,`
      : counts.trips === 1
        ? 'The journey on this phone, with its photos and voice notes,'
        : 'Your diary on this phone, with its photos and voice notes,';
  return `${what} will be backed up to this account and kept private to you.`;
}
