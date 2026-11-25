/**
 * Story link rules (pure, tested). Turning sharing on makes a NEW link, so people who had an
 * earlier link can't open the story again; re-sending a link that's still live keeps it.
 */
export function storyShareId(trip: { visibility: string | null; share_id: string | null }, mint: () => string): string {
  return trip.visibility === 'link' && trip.share_id ? trip.share_id : mint();
}

export type StopOutcome = 'stopped' | 'pending';

/** What to tell the traveller after "Stop sharing story". Only a confirmed stop says it no longer opens. */
export function stopMessage(outcome: StopOutcome): string {
  return outcome === 'stopped'
    ? 'The story link no longer opens. Anyone who already opened it may have saved what they saw.'
    : 'You’re offline. The story link stops as soon as Wayfare can reach the internet; until then it still opens.';
}

/** What to tell the traveller once a story is published. */
export function sharedMessage(pendingUploads: number): string | null {
  if (pendingUploads <= 0) return null;
  return `${pendingUploads} ${pendingUploads === 1 ? 'moment or photo is' : 'moments or photos are'} still uploading. They appear on the story when they’re backed up.`;
}
