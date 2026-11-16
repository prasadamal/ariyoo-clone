/** Serialize replication and destructive journal operations, including failures. */
export function createJournalGate() {
  let tail: Promise<unknown> = Promise.resolve();
  return function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(operation);
    tail = result.catch(() => undefined);
    return result;
  };
}
export const withJournalLock = createJournalGate();
