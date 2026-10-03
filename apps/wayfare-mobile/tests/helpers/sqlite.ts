import { DatabaseSync } from 'node:sqlite';
import type { Db } from '../../src/lib/localDb';

/** Adapts node:sqlite to the expo-sqlite async surface the app uses. */
export function createNodeDb(file = ':memory:'): Db & { raw: DatabaseSync } {
  const raw = new DatabaseSync(file);
  return {
    raw,
    async execAsync(sql) {
      raw.exec(sql);
    },
    async runAsync(sql, params = []) {
      const r = raw.prepare(sql).run(...(params as never[]));
      return { changes: Number(r.changes) };
    },
    async getAllAsync<T>(sql: string, params: unknown[] = []) {
      return raw.prepare(sql).all(...(params as never[])) as T[];
    },
    async getFirstAsync<T>(sql: string, params: unknown[] = []) {
      return (raw.prepare(sql).get(...(params as never[])) as T | undefined) ?? null;
    },
    async withTransactionAsync(task) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
