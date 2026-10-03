import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, any>;
type Result = { data: any; error: { message: string } | null };

/**
 * Minimal in-memory PostgREST stand-in. Mirrors the behaviours the sync engine
 * depends on: server-stamped updated_at, upsert-by-id, filter chains, paging, update/delete.
 */
export class FakeServer {
  tables: Record<string, Row[]> = {};
  clock = Date.parse('2026-10-01T00:00:00.000Z');
  calls: { op: string; table: string; n?: number }[] = [];
  /** Return an error message to make a write fail. */
  failWrite: (table: string, rows: Row[]) => string | null = () => null;
  storageRemoved: string[] = [];

  now() {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }

  rows(table: string) {
    return (this.tables[table] ??= []);
  }

  /** Simulates a write made from another device. */
  remoteWrite(table: string, row: Row) {
    this.upsert(table, [row]);
  }

  upsert(table: string, incoming: Row[]) {
    const stamp = this.now();
    for (const r of incoming) {
      const existing = this.rows(table).find(x => x.id === r.id);
      const created = table === 'track_points' ? { created_at: existing?.created_at ?? stamp } : {};
      const merged = { ...existing, ...r, ...created, ...(table === 'track_points' ? {} : { updated_at: stamp }) };
      if (existing) Object.assign(existing, merged);
      else this.rows(table).push(merged);
    }
  }

  client(): SupabaseClient {
    const server = this;
    return {
      from(table: string) {
        return new Builder(server, table);
      },
    } as unknown as SupabaseClient;
  }
}

class Builder implements PromiseLike<Result> {
  private op: 'select' | 'upsert' | 'update' | 'delete' = 'select';
  private payload: any;
  private filters: ((r: Row) => boolean)[] = [];
  private sort: { col: string; asc: boolean }[] = [];
  private window: [number, number] | null = null;

  constructor(private s: FakeServer, private table: string) {}

  select(_cols?: string) { this.op = 'select'; return this; }
  upsert(p: Row | Row[]) { this.op = 'upsert'; this.payload = Array.isArray(p) ? p : [p]; return this; }
  update(p: Row) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c: string, v: unknown) { this.filters.push(r => r[c] === v); return this; }
  gte(c: string, v: string) { this.filters.push(r => String(r[c]) >= v); return this; }
  order(c: string, o?: { ascending?: boolean }) { this.sort.push({ col: c, asc: o?.ascending !== false }); return this; }
  range(a: number, b: number) { this.window = [a, b]; return this; }

  then<T1 = Result, T2 = never>(ok?: ((v: Result) => T1 | PromiseLike<T1>) | null, bad?: ((e: unknown) => T2 | PromiseLike<T2>) | null) {
    return Promise.resolve(this.run()).then(ok, bad);
  }

  private run(): Result {
    const s = this.s;
    const rows = s.rows(this.table);
    s.calls.push({ op: this.op, table: this.table, n: Array.isArray(this.payload) ? this.payload.length : undefined });
    switch (this.op) {
      case 'upsert': {
        const err = s.failWrite(this.table, this.payload);
        if (err) return { data: null, error: { message: err } };
        s.upsert(this.table, this.payload);
        return { data: null, error: null };
      }
      case 'update': {
        const stamp = s.now();
        for (const r of rows.filter(r => this.filters.every(f => f(r)))) Object.assign(r, this.payload, this.table === 'track_points' ? {} : { updated_at: stamp });
        return { data: null, error: null };
      }
      case 'delete': {
        s.tables[this.table] = rows.filter(r => !this.filters.every(f => f(r)));
        return { data: null, error: null };
      }
      default: {
        let out = rows.filter(r => this.filters.every(f => f(r)));
        for (const { col, asc } of [...this.sort].reverse()) {
          out = [...out].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1));
        }
        if (this.window) out = out.slice(this.window[0], this.window[1] + 1);
        return { data: out.map(r => ({ ...r })), error: null };
      }
    }
  }
}
