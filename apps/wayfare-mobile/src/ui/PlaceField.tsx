import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Chip, Text, TextInput } from 'react-native-paper';
import type { Destination } from '../content/destinations';
import { matchDestination, searchDestinations } from '../lib/places';
import { useAppTheme } from '../theme';

type Props = {
  label?: string;
  value: string;
  onChange: (text: string, destination: Destination | undefined) => void;
};

/** Destination input with catalog suggestions — picking one links trips, rooms and matches. */
export function PlaceField({ label = 'Destination', value, onChange }: Props) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const matched = matchDestination(value);
  const suggestions = useMemo(
    () => (value.trim().length >= 2 ? searchDestinations({ query: value }).slice(0, 5) : []),
    [value]
  );
  const showSuggestions = focused && suggestions.length > 0 && !(matched && matched.name === value);
  return (
    <View>
      <TextInput
        mode="outlined"
        label={label}
        value={value}
        onChangeText={t => onChange(t, matchDestination(t))}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        left={<TextInput.Icon icon="map-marker-outline" />}
        right={matched ? <TextInput.Icon icon="check-decagram" color={colors.secondary} /> : undefined}
        autoCorrect={false}
      />
      {matched ? (
        <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4 }}>
          {matched.name} · {matched.region}, {matched.country} — travellers heading here can find you
        </Text>
      ) : null}
      {showSuggestions ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {suggestions.map(d => (
            <Chip key={d.key} icon="map-marker" compact onPress={() => onChange(d.name, d)}>
              {d.name}
            </Chip>
          ))}
        </View>
      ) : null}
    </View>
  );
}
