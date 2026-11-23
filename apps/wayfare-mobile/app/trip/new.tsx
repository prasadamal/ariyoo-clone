import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { uuid } from '../../src/lib/id';
import { getDestination } from '../../src/content/destinations';
import { useAuth } from '../../src/context/AuthContext';
import { useToast } from '../../src/context/ToastContext';
import { TripForm, emptyTripForm, type TripFormValues } from '../../src/features/trip/TripForm';
import { setTripCover, upsertTrip } from '../../src/lib/localDb';
import { placeKeyFor } from '../../src/lib/places';
import { pushTripNow } from '../../src/lib/sync';
import { Screen } from '../../src/ui/Screen';

export default function NewTripScreen() {
  const params = useLocalSearchParams<{ placeKey?: string; title?: string; tripType?: string; startsOn?: string; endsOn?: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const initial = useMemo(() => {
    const d = getDestination(params.placeKey ? String(params.placeKey) : null);
    return emptyTripForm({
      title: params.title ? String(params.title) : d?.name ?? '',
      destination: d?.name ?? '',
      destinationMatch: d,
      tripType: params.tripType ? String(params.tripType) : d?.kinds.includes('trek') ? 'trek' : d?.kinds.includes('beach') ? 'beach' : 'trek',
      currency: d?.currency ?? 'INR',
      startsOn: params.startsOn ? String(params.startsOn) : null,
      endsOn: params.endsOn ? String(params.endsOn) : null,
    });
  }, [params.placeKey, params.title, params.tripType, params.startsOn, params.endsOn]);

  const create = async (v: TripFormValues) => {
    setBusy(true);
    try {
      const id = uuid();
      const d = v.destinationMatch;
      await upsertTrip({
        id,
        title: v.title.trim(),
        trip_type: v.tripType,
        destination: v.destination.trim() || null,
        starts_on: v.startsOn,
        ends_on: v.endsOn,
        visibility: 'private',
        companions: v.companions.trim() || null,
        status: 'active',
        notes: v.notes.trim() || null,
        share_id: null,
        place_key: d?.key ?? placeKeyFor(v.destination),
        open_to_meet: v.openToMeet && user ? 1 : 0,
        currency: v.currency,
        budget_total: v.budget ? Number(v.budget) : null,
        dest_lat: d?.lat ?? null,
        dest_lng: d?.lng ?? null,
        sync_status: 'pending',
        updated_at: new Date().toISOString(),
      });
      if (v.coverUri) await setTripCover(id, v.coverUri);
      // Packing comes from your personal lists (short / long / custom) in the Pack tab.
      if (v.openToMeet && user) {
        // Upload now so matching (and match notifications) work immediately.
        await pushTripNow(user.id, id).catch(() => toast('Saved offline — matching starts once you are online.'));
      }
      router.replace(`/trip/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create journey');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TripForm initial={initial} submitLabel="Create journey" busy={busy} onSubmit={create} />
    </Screen>
  );
}
