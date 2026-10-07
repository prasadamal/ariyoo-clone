import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, HelperText, IconButton, Text, TextInput } from 'react-native-paper';
import { GuidelinesGate } from '../../src/components/GuidelinesGate';
import { MEETUP_SAFETY } from '../../src/content/safety';
import { useToast } from '../../src/context/ToastContext';
import { screenText } from '../../src/lib/contentFilter';
import { matchDestination, placeLabel } from '../../src/lib/places';
import { BOARD_KINDS, createBoardPost } from '../../src/social/board';
import type { BoardKind } from '../../src/social/types';
import { useAppTheme } from '../../src/theme';
import { ChipSelect } from '../../src/ui/ChipSelect';
import { DateField } from '../../src/ui/DateField';
import { Icon } from '../../src/ui/Icon';
import { Notice } from '../../src/ui/Notice';
import { PlaceField } from '../../src/ui/PlaceField';
import { Screen } from '../../src/ui/Screen';

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export default function NewBoardPostScreen() {
  const params = useLocalSearchParams<{ placeKey?: string }>();
  const { colors } = useAppTheme();
  const toast = useToast();
  const initialPlace = params.placeKey ? matchDestination(String(params.placeKey))?.name ?? placeLabel(String(params.placeKey)) : '';
  const [kind, setKind] = useState<BoardKind>('buddy');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [place, setPlace] = useState(initialPlace);
  const [startsOn, setStartsOn] = useState<string | null>(null);
  const [endsOn, setEndsOn] = useState<string | null>(null);
  const [meetTime, setMeetTime] = useState('');
  const [spots, setSpots] = useState(2);
  const [budget, setBudget] = useState<'shoestring' | 'moderate' | 'comfort' | ''>('');
  const [busy, setBusy] = useState(false);

  const isMeetup = kind === 'meetup';
  const timeOk = !isMeetup || !meetTime || TIME_RE.test(meetTime);
  const filter = useMemo(() => screenText(`${title}\n${body}`), [title, body]);
  const valid = title.trim().length >= 3 && place.trim().length >= 2 && timeOk && filter.ok && (!isMeetup || !!startsOn);

  const placeholders: Record<BoardKind, string> = {
    buddy: 'e.g. Looking for 2 people for Hampta Pass, 15–19 Jul',
    meetup: 'e.g. Sunset at Triund top + chai',
    ride: 'e.g. Sharing a jeep Manali → Kaza on Friday',
    stay: 'e.g. Splitting a homestay in Old Manali for 3 nights',
  };

  const submit = async () => {
    setBusy(true);
    try {
      let meetAt: string | null = null;
      if (isMeetup && startsOn) {
        const [h, m] = (meetTime || '18:00').split(':').map(Number);
        const d = new Date(`${startsOn}T00:00:00`);
        d.setHours(h, m, 0, 0);
        meetAt = d.toISOString();
      }
      const id = await createBoardPost({
        kind,
        title,
        body,
        placeName: place,
        startsOn,
        endsOn: isMeetup ? null : endsOn,
        meetAt,
        spots,
        budgetLevel: budget || null,
      });
      router.replace(`/board/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not post');
    } finally {
      setBusy(false);
    }
  };

  return (
    <GuidelinesGate what="post to the travel board">
      <Screen>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {BOARD_KINDS.map(k => {
            const active = k.value === kind;
            return (
              <Pressable
                key={k.value}
                onPress={() => setKind(k.value)}
                style={{
                  width: '48%',
                  padding: 12,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: active ? colors.tertiary : colors.border,
                  backgroundColor: active ? colors.tertiaryContainer : colors.surface,
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <Icon name={k.icon} size={22} color={active ? colors.onTertiaryContainer : colors.onSurfaceVariant} />
                <Text style={{ fontWeight: '800', marginTop: 4 }}>{k.label}</Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>{k.blurb}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ gap: 12, marginTop: 16 }}>
          <TextInput mode="outlined" label="Headline" placeholder={placeholders[kind]} value={title} onChangeText={setTitle} maxLength={120} />
          <PlaceField label="Where" value={place} onChange={t => setPlace(t)} />
          {isMeetup ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <DateField label="Day" value={startsOn} onChange={setStartsOn} minimumDate={new Date()} clearable={false} />
              </View>
              <TextInput
                mode="outlined"
                label="Time"
                placeholder="18:00"
                value={meetTime}
                onChangeText={setMeetTime}
                style={{ width: 110 }}
                error={!timeOk}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <DateField label="From" value={startsOn} onChange={setStartsOn} minimumDate={new Date()} />
              </View>
              <View style={{ flex: 1 }}>
                <DateField label="Until" value={endsOn} onChange={setEndsOn} minimumDate={startsOn ? new Date(`${startsOn}T00:00:00`) : new Date()} />
              </View>
            </View>
          )}
          {isMeetup && !timeOk ? <HelperText type="error">Use 24-hour time like 18:30</HelperText> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontWeight: '700', flex: 1 }}>Spots for others</Text>
            <IconButton icon="minus" mode="outlined" onPress={() => setSpots(Math.max(1, spots - 1))} accessibilityLabel="Fewer spots" />
            <Text style={{ fontWeight: '900', fontSize: 18, minWidth: 24, textAlign: 'center' }}>{spots}</Text>
            <IconButton icon="plus" mode="outlined" onPress={() => setSpots(Math.min(50, spots + 1))} accessibilityLabel="More spots" />
          </View>
          <Text style={{ fontWeight: '700' }}>Budget style</Text>
          <ChipSelect
            allowDeselect
            options={[
              { value: 'shoestring', label: 'Shoestring', icon: 'piggy-bank-outline' },
              { value: 'moderate', label: 'Moderate', icon: 'wallet-outline' },
              { value: 'comfort', label: 'Comfort', icon: 'sofa-outline' },
            ]}
            value={budget || null}
            onChange={v => setBudget(v as typeof budget)}
          />
          <TextInput mode="outlined" label="Details" placeholder="Plan, pace, what you are looking for…" value={body} onChangeText={setBody} multiline style={{ minHeight: 110 }} maxLength={2000} />
          {!filter.ok ? <Notice tone="warning" text={filter.reason} /> : null}
          <Notice tone="info" icon="shield-check-outline" text={MEETUP_SAFETY.slice(0, 3).join(' · ')} />
          <Button mode="contained" onPress={submit} loading={busy} disabled={!valid || busy}>
            Post to the board
          </Button>
        </View>
      </Screen>
    </GuidelinesGate>
  );
}
