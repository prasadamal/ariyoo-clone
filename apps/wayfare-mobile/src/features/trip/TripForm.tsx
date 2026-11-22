import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, Switch, Text, TextInput } from 'react-native-paper';
import type { Destination } from '../../content/destinations';
import { TRIP_TYPES } from '../../content/tripTypes';
import { useCanConnect } from '../../context/AuthContext';
import { POPULAR_CURRENCIES } from '../../lib/currencyMath';
import { matchDestination } from '../../lib/places';
import { useAppTheme } from '../../theme';
import { ChipSelect } from '../../ui/ChipSelect';
import { DateRangeField } from '../../ui/DateRangeField';
import { CoverPicker } from './CoverPicker';
import { PlaceField } from '../../ui/PlaceField';
import { SOCIAL_ENABLED } from '../../lib/features';

export type TripFormValues = {
  title: string;
  destination: string;
  destinationMatch: Destination | undefined;
  tripType: string;
  startsOn: string | null;
  endsOn: string | null;
  companions: string;
  currency: string;
  budget: string;
  notes: string;
  openToMeet: boolean;
  /** Cover photo kept on this phone (a stored file), or null. */
  coverUri: string | null;
};

export function emptyTripForm(partial: Partial<TripFormValues> = {}): TripFormValues {
  return {
    title: '',
    destination: '',
    destinationMatch: undefined,
    tripType: 'trek',
    startsOn: null,
    endsOn: null,
    companions: '',
    currency: 'INR',
    budget: '',
    notes: '',
    openToMeet: false,
    coverUri: null,
    ...partial,
  };
}

type Props = {
  initial: TripFormValues;
  submitLabel: string;
  busy?: boolean;
  onSubmit: (values: TripFormValues) => void;
};

export function TripForm({ initial, submitLabel, busy, onSubmit }: Props) {
  const { colors } = useAppTheme();
  const canConnect = useCanConnect();
  const [v, setV] = useState<TripFormValues>(initial);
  const [titleTouched, setTitleTouched] = useState(!!initial.title);
  const set = (patch: Partial<TripFormValues>) => setV(prev => ({ ...prev, ...patch }));

  useEffect(() => {
    setV(initial);
    setTitleTouched(!!initial.title);
  }, [initial.title, initial.destination]);

  const onDestination = (text: string, match: Destination | undefined) => {
    const patch: Partial<TripFormValues> = { destination: text, destinationMatch: match ?? matchDestination(text) };
    const d = patch.destinationMatch;
    if (d && !titleTouched) patch.title = d.name;
    if (d && v.currency === 'INR' && d.currency !== 'INR') patch.currency = d.currency;
    if (d && d.kinds.includes('trek') && v.tripType !== 'trek' && !titleTouched) patch.tripType = 'trek';
    set(patch);
  };

  const datesInvalid = !!(v.startsOn && v.endsOn && v.endsOn < v.startsOn);
  const budgetInvalid = !!v.budget && !(Number(v.budget) > 0);
  const canSubmit = v.title.trim().length > 0 && !datesInvalid && !budgetInvalid && !busy;

  return (
    <View style={{ gap: 12 }}>
      <PlaceField value={v.destination} onChange={onDestination} label="Where are you going?" />
      <TextInput
        mode="outlined"
        label="Journey title"
        value={v.title}
        onChangeText={t => {
          setTitleTouched(true);
          set({ title: t });
        }}
        maxLength={120}
      />
      <CoverPicker value={v.coverUri} onChange={uri => set({ coverUri: uri })} />
      <Text style={{ fontWeight: '600', marginTop: 4 }}>Type of journey</Text>
      <ChipSelect options={TRIP_TYPES} value={v.tripType} onChange={t => set({ tripType: t })} />
      <DateRangeField startsOn={v.startsOn} endsOn={v.endsOn} onChange={r => set(r)} />
      {datesInvalid ? <HelperText type="error">The end date is before the start date.</HelperText> : null}
      <TextInput
        mode="outlined"
        label="Travelling with (names, comma separated)"
        value={v.companions}
        onChangeText={t => set({ companions: t })}
        left={<TextInput.Icon icon="account-multiple-outline" />}
      />
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: -6 }}>Used to split expenses fairly in the Budget tab.</Text>
      <Text style={{ fontWeight: '600', marginTop: 4 }}>Trip currency</Text>
      <ChipSelect scroll options={POPULAR_CURRENCIES.map(c => ({ value: c, label: c }))} value={v.currency} onChange={c => set({ currency: c })} />
      <TextInput
        mode="outlined"
        label={`Expected budget (${v.currency}, optional)`}
        value={v.budget}
        onChangeText={t => set({ budget: t.replace(/[^0-9.]/g, '') })}
        keyboardType="decimal-pad"
        error={budgetInvalid}
      />
      <TextInput mode="outlined" label="Notes, permits, bookings" value={v.notes} onChangeText={t => set({ notes: t })} multiline numberOfLines={3} />

      {SOCIAL_ENABLED ? (
      <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          borderRadius: 16,
          backgroundColor: colors.secondaryContainer,
          opacity: canConnect ? 1 : 0.6,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', color: colors.onSecondaryContainer }}>Open to meet travellers</Text>
          <Text style={{ color: colors.onSecondaryContainer, fontSize: 12, marginTop: 2, lineHeight: 17 }}>
            {canConnect
              ? 'Others heading to the same place around your dates can see your name and dates — never your journal or exact location.'
              : 'Sign in to find travellers heading the same way.'}
          </Text>
        </View>
        <Switch value={v.openToMeet && canConnect} onValueChange={o => set({ openToMeet: o })} disabled={!canConnect} />
      </View>
      {v.openToMeet && canConnect && (!v.startsOn || !v.destinationMatch) ? (
        <HelperText type="info">Tip: pick a listed destination and add dates so we can match you.</HelperText>
      ) : null}
      </>
      ) : null}

      <Button mode="contained" onPress={() => onSubmit(v)} loading={busy} disabled={!canSubmit} style={{ marginTop: 8 }}>
        {submitLabel}
      </Button>
    </View>
  );
}
