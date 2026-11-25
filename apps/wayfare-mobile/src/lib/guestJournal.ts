import { useEffect, useState } from 'react';
import { guestJournalCounts } from './localDb';
import { getLocalOwner } from './sync';
import { guestBackupNotice } from './guestBackupText';

/** The notice for the sign-in and sign-up screens, when this phone has journals with no account yet. */
export function useGuestBackupNotice() {
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (await getLocalOwner()) return;
      const counts = await guestJournalCounts();
      if (alive) setNotice(guestBackupNotice(counts));
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return notice;
}
