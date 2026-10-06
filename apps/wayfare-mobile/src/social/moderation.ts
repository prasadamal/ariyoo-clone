import { CommunityError, currentUserId, db, friendly } from './client';
import type { ReportReason, ReportTarget } from './types';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'sexual', label: 'Sexual content' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'unsafe', label: 'Unsafe advice or activity' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'other', label: 'Something else' },
];

export async function report(targetType: ReportTarget, targetId: string, reason: ReportReason, details?: string) {
  const me = await currentUserId();
  const { error } = await db()
    .from('reports')
    .insert({ reporter_id: me, target_type: targetType, target_id: targetId, reason, details: details?.trim() || null });
  if (error) {
    if (/duplicate key/i.test(error.message)) return 'already';
    throw new CommunityError(friendly(error));
  }
  return 'reported';
}
