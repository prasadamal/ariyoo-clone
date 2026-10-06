import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useAuth } from '../../../src/context/AuthContext';
import { useToast } from '../../../src/context/ToastContext';
import { TripForm, emptyTripForm, type TripFormValues } from '../../../src/features/trip/TripForm';
import { getTrip, updateTrip } from '../../../src/lib/localDb';
import { matchDestination, placeKeyFor } from '../../../src/lib/places';
import { pushTripNow } from '../../../src/lib/sync';
import { Screen } from '../../../src/ui/Screen';

export default function EditTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = String(id);
  const { user } = useAuth();
  const toast = useToast();
  const [initial, setInitial] = useState<TripFormValues | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getTrip(tripId).then(t => {
      if (!t) return;
      setInitial(
        emptyTripForm({
          title: t.title,
          destination: t.destination ?? '',
          destinationMatch: matchDestination(t.destination ?? '') ?? undefined,
          tripType: t.trip_type,
          startsOn: t.starts_on,
          endsOn: t.ends_on,
          companions: t.companions ?? '',
          currency: t.currency || 'INR',
          budget: t.budget_total ? String(t.budget_total) : '',
          notes: t.notes ?? '',
          openToMeet: t.open_to_meet === 1,
        })
      );
    });
  }, [tripId]);

  const save = async (v: TripFormValues) => {
    setBusy(true);
    try {
      const d = v.destinationMatch;
      await updateTrip(tripId, {
        title: v.title.trim(),
        trip_type: v.tripType,
        destination: v.destination.trim() || null,
        starts_on: v.startsOn,
        ends_on: v.endsOn,
        companions: v.companions.trim() || null,
        notes: v.notes.trim() || null,
        place_key: d?.key ?? placeKeyFor(v.destination),
        open_to_meet: v.openToMeet && user ? 1 : 0,
        currency: v.currency,
        budget_total: v.budget ? Number(v.budget) : null,
        dest_lat: d?.lat ?? null,
        dest_lng: d?.lng ?? null,
      });
      if (user) await pushTripNow(user.id, tripId).catch(() => undefined);
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  if (!initial) return <ActivityIndicator style={{ marginTop: 40 }} />;
  return (
    <Screen>
      <TripForm initial={initial} submitLabel="Save changes" busy={busy} onSubmit={save} />
    </Screen>
  );
}
