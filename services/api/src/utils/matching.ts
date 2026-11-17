export function scoreMatch(userTags: string[], questionTags: string[]): number {
  const set = new Set(userTags.map(t => t.toLowerCase()));
  let score = 0;
  for (const t of questionTags) if (set.has(t.toLowerCase())) score += 1;
  return score;
}

export type Candidate = { id: number; tags: string[]; activeSessions: number };

/**
 * Picks the expert for a question, or null to leave it in the open queue.
 * Only experts who share at least one topic are assigned directly; among equals the one with
 * the fewest active conversations wins, so one person does not receive everything.
 */
export function pickSolver(candidates: Candidate[], questionTags: string[], exclude: Set<number>): number | null {
  const ranked = candidates
    .filter(c => !exclude.has(c.id))
    .map(c => ({ ...c, score: scoreMatch(c.tags, questionTags) }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score || a.activeSessions - b.activeSessions || a.id - b.id);
  return ranked[0]?.id ?? null;
}
