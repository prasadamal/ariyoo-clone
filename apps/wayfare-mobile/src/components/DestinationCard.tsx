import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import { DESTINATION_KIND_ICONS, type Destination } from '../content/destinations';
import { useAppTheme } from '../theme';
import { Icon } from '../ui/Icon';
import { Pill } from '../ui/Pill';

export function DestinationCard({ d, inSeason }: { d: Destination; inSeason?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={() => router.push(`/place/${d.key}`)}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        marginBottom: 12,
        opacity: pressed ? 0.85 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={`${d.name}, ${d.region}, ${d.country}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={DESTINATION_KIND_ICONS[d.kinds[0]]} size={22} color={colors.onSecondaryContainer} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="titleMedium" style={{ fontWeight: '800' }}>
            {d.name}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {d.region} · {d.country}
          </Text>
        </View>
        {inSeason ? <Pill icon="white-balance-sunny" label="In season" color={colors.success} /> : null}
      </View>
      <Text style={{ color: colors.onSurfaceVariant, marginTop: 8, lineHeight: 19 }} numberOfLines={2}>
        {d.tagline}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        <Pill icon="calendar-month-outline" label={d.bestSeason} />
        {d.difficulty ? <Pill icon="speedometer" label={d.difficulty} /> : null}
        {d.maxAltitudeM ? <Pill icon="image-filter-hdr" label={`${d.maxAltitudeM.toLocaleString('en-IN')} m`} /> : null}
        {d.duration ? <Pill icon="clock-outline" label={d.duration} /> : null}
      </View>
    </Pressable>
  );
}
