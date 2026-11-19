/** What a closed question means for each side, and an expert's public record, in plain words. */

export type ResolveState = {
  role: 'seeker' | 'solver';
  resolved?: boolean;
  helpful?: boolean | null;
  /** True while no expert has picked the question up. */
  waiting?: boolean;
};

export type ExpertStats = { answered: number; helpful: number };

/** The banner over a closed conversation, or null while it is open or closed for another reason. */
export function resolvedBanner(s: ResolveState, peerName?: string | null): string | null {
  if (!s.resolved) return null;
  if (s.role === 'seeker') {
    if (s.waiting) return 'You withdrew this question.';
    if (s.helpful) return `You marked this answered and thanked ${peerName || 'the expert'}.`;
    return 'You marked this answered.';
  }
  return s.helpful ? 'The asker marked this answered and said your answer helped.' : 'The asker marked this answered.';
}

/** "12 answers · 9 found helpful", or a welcome for an expert with no finished answers yet. */
export function expertRecord(stats?: ExpertStats | null): string | null {
  if (!stats) return null;
  if (stats.answered <= 0) return 'New expert on Ariyoo';
  const answers = stats.answered === 1 ? '1 answer' : `${stats.answered} answers`;
  return stats.helpful > 0 ? `${answers} · ${stats.helpful} found helpful` : answers;
}

/** Which closing action the asker is offered, if any. */
export function closeAction(s: ResolveState & { active: boolean; blocked?: boolean }): 'answered' | 'withdraw' | null {
  if (s.role !== 'seeker' || s.resolved || !s.active || s.blocked) return null;
  return s.waiting ? 'withdraw' : 'answered';
}
