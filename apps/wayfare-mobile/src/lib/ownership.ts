type OwnershipStore = {
  owner: () => Promise<string | null>;
  count: () => Promise<number>;
  adopt: (userId: string) => Promise<void>;
};

/** Runs under the journal lock; stale account attempts must not adopt or expose a journal. */
export async function resolveJournalOwnership(userId: string, current: () => boolean, store: OwnershipStore) {
  if (!current()) return 'stale' as const;
  const owner = await store.owner();
  if (!current()) return 'stale' as const;
  if (owner && owner !== userId) {
    const count = await store.count();
    if (!current()) return 'stale' as const;
    if (count > 0) return 'conflict' as const;
  }
  if (owner !== userId) {
    await store.adopt(userId);
    if (!current()) return 'stale' as const;
  }
  return 'ready' as const;
}
