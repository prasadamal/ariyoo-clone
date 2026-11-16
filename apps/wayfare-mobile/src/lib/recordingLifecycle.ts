type RecorderIO<T> = {
  permission: () => Promise<boolean>;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  prepare: (recorder: T) => Promise<void>;
  record: (recorder: T) => void;
  stop: (recorder: T) => Promise<void>;
};

/** One microphone owner. Cancellation invalidates pending permission/preparation before recording. */
export function createRecordingLifecycle<T>(io: RecorderIO<T>) {
  type Attempt = { recorder: T; cancelled: boolean; prepared: boolean; saving: boolean;
    start: Promise<void>; stop?: Promise<void>; cleanup?: Promise<void> };
  let active: Attempt | null = null;
  const check = (attempt: Attempt) => {
    if (active !== attempt || attempt.cancelled) throw new Error('Recording cancelled.');
  };
  const stop = (attempt: Attempt) => {
    if (!attempt.prepared) return Promise.resolve();
    if (!attempt.stop) attempt.stop = io.stop(attempt.recorder);
    return attempt.stop;
  };
  const cleanup = (attempt: Attempt): Promise<void> => {
    if (attempt.cleanup) return attempt.cleanup;
    attempt.cleanup = (async () => {
      await stop(attempt);
      await io.disable();
      if (active === attempt) active = null;
    })().catch(error => {
      // Keep ownership and allow cleanup to be retried after a native failure.
      attempt.cleanup = undefined;
      attempt.stop = undefined;
      throw error;
    });
    return attempt.cleanup;
  };
  const start = (recorder: T) => {
    if (active) return Promise.reject(new Error('A voice recording is already active.'));
    const attempt: Attempt = { recorder, cancelled: false, prepared: false, saving: false, start: Promise.resolve() };
    active = attempt;
    attempt.start = (async () => {
      try {
        const allowed = await io.permission();
        check(attempt);
        if (!allowed) throw new Error('Microphone permission is required for voice notes.');
        await io.enable();
        check(attempt);
        await io.prepare(recorder);
        attempt.prepared = true;
        check(attempt);
        io.record(recorder);
      } catch (error) {
        await cleanup(attempt);
        throw error;
      }
    })();
    return attempt.start;
  };
  const cancel = async (recorder: T) => {
    const attempt = active;
    if (!attempt || attempt.recorder !== recorder) return;
    attempt.cancelled = true;
    await attempt.start.catch(() => undefined);
    await cleanup(attempt);
  };
  const save = async (recorder: T, persist: (isCurrent: () => boolean) => Promise<void>) => {
    const attempt = active;
    if (!attempt || attempt.recorder !== recorder || attempt.saving) throw new Error('No voice note is ready to save.');
    attempt.saving = true;
    try {
      await attempt.start;
      check(attempt);
      await stop(attempt);
      await io.disable();
      check(attempt);
      await persist(() => active === attempt && !attempt.cancelled);
    } finally {
      await cleanup(attempt);
    }
  };
  return { start, cancel, save, cancelActive: () => active ? cancel(active.recorder) : Promise.resolve() };
}
