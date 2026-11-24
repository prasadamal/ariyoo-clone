import { getRates } from './currency';
import { splitSpend, type MoneyAmount } from './currencyMath';
import type { LocalTrip } from './localDb';
import { tripCoverUri } from './tripCover';
import { tripStatus } from './tripList';
import { buildTripSynopsis, computeTripStats } from './tripStats';

/** A journey ready for its tile: its one-line summary, money and cover. */
export type TripRow = LocalTrip & { synopsis: string; packingRatio: number; spentAmount: number; unconverted: MoneyAmount[]; cover: string | null };

/** Stats, spend in the journey's currency and the cover picture, for the cards being shown. */
export async function prepareTripRows(list: LocalTrip[]): Promise<TripRow[]> {
  const rates = await getRates().catch(() => null);
  return Promise.all(
    list.map(async t => {
      const stats = await computeTripStats(t.id, t);
      const spend = splitSpend(stats.spendByCurrency, t.currency || 'INR', rates?.rates ?? null);
      return {
        ...t,
        synopsis: buildTripSynopsis(t.title, stats, tripStatus(t) === 'completed'),
        packingRatio: stats.packingTotal ? stats.packingDone / stats.packingTotal : 0,
        spentAmount: spend.total,
        unconverted: spend.pending,
        cover: await tripCoverUri(t).catch(() => null),
      };
    })
  );
}
