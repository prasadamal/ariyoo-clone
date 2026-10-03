import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSync } from '../context/SyncContext';
import {
  getTrip,
  listEntries,
  listExpenses,
  listPacking,
  listTrackPointsForExport,
  type LocalEntry,
  type LocalExpense,
  type LocalPackingItem,
  type LocalTrip,
} from '../lib/localDb';
import { getActiveTrackingTripId } from '../lib/tracking';
import { buildTripSynopsis, computeTripStats } from '../lib/tripStats';

export type TripData = {
  loaded: boolean;
  trip: LocalTrip | null;
  synopsis: string;
  entries: LocalEntry[];
  expenses: LocalExpense[];
  packing: LocalPackingItem[];
  route: { latitude: number; longitude: number }[];
  tracking: boolean;
};

const EMPTY: TripData = {
  loaded: false,
  trip: null,
  synopsis: '',
  entries: [],
  expenses: [],
  packing: [],
  route: [],
  tracking: false,
};

/** Loads everything for one trip from SQLite; reloads on focus and after every sync/local change. */
export function useTripData(tripId: string) {
  const { dataVersion, notifyLocalChange } = useSync();
  const [data, setData] = useState<TripData>(EMPTY);

  const load = useCallback(async () => {
    const trip = await getTrip(tripId);
    if (!trip) {
      setData({ ...EMPTY, loaded: true });
      return;
    }
    const [entries, expenses, packing, points, stats, active] = await Promise.all([
      listEntries(tripId),
      listExpenses(tripId),
      listPacking(tripId),
      listTrackPointsForExport(tripId),
      computeTripStats(tripId),
      getActiveTrackingTripId(),
    ]);
    setData({
      loaded: true,
      trip,
      synopsis: buildTripSynopsis(trip.title, stats),
      entries,
      expenses,
      packing,
      route: points.map(p => ({ latitude: p.latitude, longitude: p.longitude })),
      tracking: active === tripId,
    });
  }, [tripId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { load(); }, [load, dataVersion]));

  /** Call after any local write. */
  const changed = useCallback(() => {
    notifyLocalChange();
  }, [notifyLocalChange]);

  return { ...data, reload: load, changed };
}
