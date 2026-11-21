import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import { compactNumber, formatAltitude, formatKm } from '../lib/format';
import { nextTierProgress, normalizeTier, TIER_META } from '../lib/tiers';
import { styleLabel } from '../social/types';
import { useAppTheme } from '../theme';
import { Avatar } from '../ui/Avatar';
import { Pill } from '../ui/Pill';
import { TierBadge } from '../ui/TierBadge';
import { Meter } from '../ui/Meter';

type Props = {
  id: string;
  name: string;
  username: string | null;
  avatarPath: string | null;
  bio: string | null;
  homeRegion: string | null;
  homeCountry: string | null;
  styles: string[];
  languages: string[];
  tier: string;
  verifiedKm: number;
  maxAltitudeM: number;
  trips: number;
  followers: number;
  following: number;
  posts: number;
  actions?: ReactNode;
  showTierProgress?: boolean;
};

function Count({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ alignItems: 'center', flex: 1 }} accessibilityRole={onPress ? 'button' : undefined}>
      <Text variant="titleLarge" style={{ fontWeight: '800' }}>
        {compactNumber(value)}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

export function ProfileHeader(p: Props) {
  const { colors } = useAppTheme();
  const tier = normalizeTier(p.tier);
  const progress = nextTierProgress(p.verifiedKm, p.maxAltitudeM);
  const tierColor = tier === 'legendary' ? colors.tierLegendary : tier === 'hardcore' ? colors.tierHardcore : colors.primary;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Avatar id={p.id} name={p.name} path={p.avatarPath} size={84} ring={tierColor} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="headlineSmall" style={{ fontWeight: '900' }} numberOfLines={2}>
            {p.name}
          </Text>
          {p.username ? <Text style={{ color: colors.muted }}>@{p.username}</Text> : null}
          <View style={{ marginTop: 6 }}>
            <TierBadge tier={p.tier} />
          </View>
        </View>
      </View>
      {p.bio ? <Text style={{ marginTop: 12, lineHeight: 21 }}>{p.bio}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {p.homeRegion || p.homeCountry ? <Pill icon="home-outline" label={[p.homeRegion, p.homeCountry].filter(Boolean).join(', ')} /> : null}
        {p.styles.slice(0, 6).map(s => (
          <Pill key={s} label={styleLabel(s)} />
        ))}
        {p.languages.length ? <Pill icon="translate" label={p.languages.join(', ')} /> : null}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
        <Count value={p.trips} label="Trips" />
        <Count value={p.posts} label="Posts" />
        <Count value={p.followers} label="Followers" onPress={() => router.push({ pathname: '/follows/[id]', params: { id: p.id, dir: 'followers' } })} />
        <Count value={p.following} label="Following" onPress={() => router.push({ pathname: '/follows/[id]', params: { id: p.id, dir: 'following' } })} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <View style={{ flex: 1, padding: 12, borderRadius: 16, backgroundColor: colors.secondaryContainer }}>
          <Text style={{ color: colors.onSecondaryContainer, fontSize: 12 }}>GPS-verified</Text>
          <Text style={{ color: colors.onSecondaryContainer, fontWeight: '800', fontSize: 18 }}>{formatKm(p.verifiedKm)}</Text>
        </View>
        <View style={{ flex: 1, padding: 12, borderRadius: 16, backgroundColor: colors.tertiaryContainer }}>
          <Text style={{ color: colors.onTertiaryContainer, fontSize: 12 }}>Highest point</Text>
          <Text style={{ color: colors.onTertiaryContainer, fontWeight: '800', fontSize: 18 }}>{p.maxAltitudeM ? formatAltitude(p.maxAltitudeM) : '—'}</Text>
        </View>
      </View>
      {p.showTierProgress && progress.next ? (
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 12, color: colors.muted }}>Next: {TIER_META[progress.next].label}</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>{Math.round(progress.progress * 100)}%</Text>
          </View>
          <Meter progress={progress.progress} color={tierColor} height={6} />
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>{progress.hint}</Text>
        </View>
      ) : null}
      {p.actions ? <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>{p.actions}</View> : null}
    </View>
  );
}
