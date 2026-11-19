export type SessionRow = {
  sessionId: number;
  title: string;
  active: boolean;
  role?: 'seeker' | 'solver';
  waiting?: boolean;
  peerName?: string | null;
  resolved?: boolean;
  helpful?: boolean | null;
  updatedAt?: string;
};

/** One list from "my questions" and "questions I answer", newest activity first, no duplicates. */
export function mergeSessions(asked: SessionRow[], answering: SessionRow[]): SessionRow[] {
  const byId = new Map<number, SessionRow>();
  for (const row of [...asked, ...answering]) if (!byId.has(row.sessionId)) byId.set(row.sessionId, row);
  return [...byId.values()].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || b.sessionId - a.sessionId);
}

export function sessionSubtitle(row: SessionRow): string {
  if (row.resolved) {
    if (row.role === 'solver') return row.helpful ? `${row.peerName || 'The asker'} said your answer helped` : 'Marked answered';
    if (row.waiting) return 'Withdrawn';
    return row.helpful ? `Answered by ${row.peerName || 'an expert'} · helped` : 'Answered';
  }
  if (!row.active) return 'Closed';
  if (row.role === 'solver') return row.peerName ? `You are answering ${row.peerName}` : 'You are answering';
  if (row.waiting) return 'Waiting for an expert';
  return row.peerName ? `Answered by ${row.peerName}` : 'Active';
}
