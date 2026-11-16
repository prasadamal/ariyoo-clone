/** A successful UI stop requires the server's acknowledgement; keep the link retryable on failure. */
export async function revokeLiveShare<T extends { id: string }>(deps: {
  read: () => Promise<T | null>;
  expire: (id: string) => Promise<void>;
  write: (state: T | null) => Promise<void>;
}) {
  const state = await deps.read();
  if (!state) return;
  await deps.expire(state.id);
  if ((await deps.read())?.id === state.id) await deps.write(null);
}

/** An old push must not resurrect an ended or replaced link. */
export async function acknowledgeLivePush<T extends { id: string; lastPushAt?: string }>(deps: {
  read: () => Promise<T | null>;
  write: (state: T) => Promise<void>;
}, id: string, at: string) {
  const current = await deps.read();
  if (current?.id === id) await deps.write({ ...current, lastPushAt: at });
}
