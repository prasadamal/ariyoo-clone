/**
 * When an editor on a shared journey becomes a viewer (the owner changed their role) while they had
 * changes waiting offline, the server will refuse those changes. Sync drops them so the journey
 * matches what everyone else sees, but first keeps a copy of the words here so nothing typed is
 * lost silently; the trip page shows a notice with "Copy my words". Storage: unsavedChangesStore.ts.
 */
export type UnsavedCopy = { count: number; text: string; at: string };

export type PendingRows = {
  entries: { body: string | null; recorded_at: string | null }[];
  expenses: { category: string; amount: number; currency: string; note: string | null }[];
  plans: { title: string; notes: string | null }[];
  other: number;
};

/** Plain-text copy of what couldn't be saved, oldest moment first. Pure, for tests. */
export function unsavedText(rows: PendingRows): string {
  const lines: string[] = [];
  const moments = [...rows.entries].sort((a, b) => String(a.recorded_at ?? '').localeCompare(String(b.recorded_at ?? '')));
  for (const m of moments) if (m.body?.trim()) lines.push(`• ${m.body.trim()}`);
  for (const e of rows.expenses) lines.push(`• ${e.category}: ${e.currency} ${e.amount}${e.note?.trim() ? ` (${e.note.trim()})` : ''}`);
  for (const p of rows.plans) lines.push(`• Plan: ${p.title}${p.notes?.trim() ? ` (${p.notes.trim()})` : ''}`);
  return lines.join('\n');
}

export function pendingCount(rows: PendingRows) {
  return rows.entries.length + rows.expenses.length + rows.plans.length + rows.other;
}

/** The notice on the trip page. Pure, for tests. */
export function unsavedNotice(count: number) {
  const what = count === 1 ? '1 change' : `${count} changes`;
  return `You can now only view this journey, so ${what} you made offline couldn’t be saved. Copy your words to keep them.`;
}
