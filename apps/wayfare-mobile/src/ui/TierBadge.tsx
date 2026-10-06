import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { normalizeTier, TIER_META } from '../lib/tiers';
import { useAppTheme } from '../theme';
import { Icon } from './Icon';

export function TierBadge({ tier, compact }: { tier: string | null | undefined; compact?: boolean }) {
  const { colors } = useAppTheme();
  const t = normalizeTier(tier);
  if (compact && t === 'traveler') return null;
  const color = t === 'legendary' ? colors.tierLegendary : t === 'hardcore' ? colors.tierHardcore : colors.tierTraveler;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: compact ? 5 : 8,
        paddingVertical: 2,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: color,
        alignSelf: 'flex-start',
      }}
      accessibilityLabel={`${TIER_META[t].label} tier`}
    >
      <Icon name={TIER_META[t].icon} size={compact ? 11 : 13} color={color} />
      {compact ? null : <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{TIER_META[t].label}</Text>}
    </View>
  );
}
