import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export class CommunityError extends Error {}

export function db() {
  if (!supabase) throw new CommunityError('Community features need Wayfare cloud — it is not configured in this build.');
  return supabase;
}

/** Turns Postgres / PostgREST errors into traveller-friendly messages. */
export function friendly(error: PostgrestError | Error | null | undefined, fallback = 'Something went wrong') {
  if (!error) return fallback;
  const msg = error.message || fallback;
  if (/JWT|not authenticated|permission denied for/i.test(msg)) return 'Please sign in again.';
  if (/row-level security/i.test(msg)) return 'You do not have access to that.';
  if (/duplicate key/i.test(msg)) return 'Already done.';
  if (/Failed to fetch|Network request failed/i.test(msg)) return 'You appear to be offline. Try again when connected.';
  return msg.replace(/^.*?ERROR:\s*/, '');
}

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) throw new CommunityError(friendly(error));
  return data as T;
}

export async function currentUserId() {
  const { data } = await db().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new CommunityError('Sign in to connect with travellers.');
  return id;
}
