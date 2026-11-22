import { useMemo } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAuth } from '../src/context/AuthContext';
import { computeBadges, LEVEL_COLORS, LEVEL_NAMES, sortBadges } from '../src/lib/badges';
import { formatAltitude, formatKm } from '../src/lib/format';
import { computeTier, nextTierProgress, TIER_META, TIER_RULES, type Tier } from '../src/lib/tiers';
import { useTravelStats } from '../src/lib/useTravelStats';
import { useAppTheme } from '../src/theme';
import { Icon } from '../src/ui/Icon';
import { Screen } from '../src/ui/Screen';
import { SectionHeader } from '../src/ui/SectionHeader';
import { Meter } from '../src/ui/Meter';

export default function BadgesScreen() {
  const { colors } = useAppTheme();
  const { profile } = useAuth();
  const stats = useTravelStats();
  const badges = useMemo(() => (stats ? sortBadges(computeBadges(stats)) : []), [stats]);
  // Verified (cloud) stats win when signed in; otherwise preview from this device.
  const km = profile ? profile.verified_km : stats?.km ?? 0;
  const alt = profile ? profile.max_altitude_m : stats?.maxAltitudeM ?? 0;
  const tier: Tier = profile ? (['hardcore', 'legendary'].includes(profile.tier) ? (profile.tier as Tier) : 'traveler') : computeTier(km, alt);
  const progress = nextTierProgress(km, alt);
  const tierColor = (t: Tier) => (t === 'legendary' ? colors.tierLegendary : t === 'hardcore' ? colors.tierHardcore : colors.tierTraveler);

  return (
    <Screen>
      <SectionHeader title="Traveller tier" subtitle={profile ? 'Verified from your recorded GPS routes' : 'Preview from this device — sign in to verify'} style={{ marginTop: 0 }} />
      <View style={{ gap: 10 }}>
        {(['traveler', 'hardcore', 'legendary'] as Tier[]).map(t => {
          const active = t === tier;
          return (
            <View
              key={t}
              style={{
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
                padding: 14,
                borderRadius: 16,
                borderWidth: active ? 2 : 1,
                borderColor: active ? tierColor(t) : colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <Icon name={TIER_META[t].icon} size={28} color={tierColor(t)} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800' }}>
                  {TIER_META[t].label}
                  {active ? '  · you' : ''}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>{TIER_META[t].blurb}</Text>
              </View>
            </View>
          );
        })}
      </View>
      {progress.next ? (
        <View style={{ marginTop: 12 }}>
          <Meter progress={progress.progress} color={tierColor(progress.next)} height={8} />
          <Text style={{ color: colors.muted, marginTop: 6 }}>
            {progress.hint} · now {formatKm(km)} and {formatAltitude(alt || null)} (needs {TIER_RULES[progress.next].km} km or {TIER_RULES[progress.next].altitudeM.toLocaleString('en-IN')} m)
          </Text>
        </View>
      ) : null}

      <SectionHeader title="Badges" subtitle={`${badges.filter(b => b.earned).length} of ${badges.length} earned`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {badges.map(b => (
          <View
            key={b.id}
            style={{ width: '48%', padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: b.earned ? b.color : colors.border }}
            accessibilityLabel={`${b.title}: ${b.description}. Level ${b.level} of ${b.maxLevel}`}
          >
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: b.earned ? b.color : colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={b.icon} size={24} color={b.earned ? '#fff' : colors.muted} />
            </View>
            <Text style={{ fontWeight: '800', marginTop: 8 }}>{b.title}</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{b.description}</Text>
            {/* Level dots: one per level, filled up to the level reached. */}
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }} accessibilityElementsHidden>
              {Array.from({ length: b.maxLevel }, (_, i) => (
                <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < b.level ? LEVEL_COLORS[i] : colors.surfaceVariant }} />
              ))}
            </View>
            {b.level < b.maxLevel ? (
              <>
                <Meter progress={b.progress} color={LEVEL_COLORS[b.level]} height={5} style={{ marginTop: 6 }} />
                <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
                  Next: {LEVEL_NAMES[b.level]} at {b.target.toLocaleString('en-IN')}{b.unit ? ` ${b.unit}` : ''}
                </Text>
              </>
            ) : (
              <Text style={{ fontSize: 11, color: colors.success, marginTop: 6, fontWeight: '700' }}>Top level ✓</Text>
            )}
          </View>
        ))}
      </View>
    </Screen>
  );
}
