/** Traveller tiers — mirrors the server's compute_tier() so local previews match verified badges. */

export type Tier = 'traveler' | 'hardcore' | 'legendary';

export const TIER_RULES = {
  hardcore: { km: 100, altitudeM: 4000 },
  legendary: { km: 500, altitudeM: 5500 },
} as const;

export const TIER_META: Record<Tier, { label: string; icon: string; blurb: string }> = {
  traveler: { label: 'Traveller', icon: 'compass-outline', blurb: 'Every journey starts with the first entry.' },
  hardcore: {
    label: 'Hardcore',
    icon: 'fire',
    blurb: `${TIER_RULES.hardcore.km} km of GPS-verified routes or ${TIER_RULES.hardcore.altitudeM.toLocaleString('en-IN')} m reached.`,
  },
  legendary: {
    label: 'Legendary',
    icon: 'crown',
    blurb: `${TIER_RULES.legendary.km} km verified or above ${TIER_RULES.legendary.altitudeM.toLocaleString('en-IN')} m.`,
  },
};

export function computeTier(km: number, maxAltitudeM: number): Tier {
  if (km >= TIER_RULES.legendary.km || maxAltitudeM >= TIER_RULES.legendary.altitudeM) return 'legendary';
  if (km >= TIER_RULES.hardcore.km || maxAltitudeM >= TIER_RULES.hardcore.altitudeM) return 'hardcore';
  return 'traveler';
}

export function normalizeTier(value: string | null | undefined): Tier {
  return value === 'hardcore' || value === 'legendary' ? value : 'traveler';
}

/** Progress (0–1) toward the next tier via whichever path (distance or altitude) is closer. */
export function nextTierProgress(km: number, maxAltitudeM: number) {
  const current = computeTier(km, maxAltitudeM);
  if (current === 'legendary') return { current, next: null as Tier | null, progress: 1, hint: 'Top tier reached' };
  const next: Tier = current === 'traveler' ? 'hardcore' : 'legendary';
  const rule = TIER_RULES[next];
  const byKm = Math.min(1, km / rule.km);
  const byAlt = Math.min(1, maxAltitudeM / rule.altitudeM);
  const progress = Math.max(byKm, byAlt);
  const kmLeft = Math.max(0, rule.km - km);
  const hint =
    byKm >= byAlt
      ? `${Math.ceil(kmLeft)} km of recorded route to ${TIER_META[next].label}`
      : `Reach ${rule.altitudeM.toLocaleString('en-IN')} m for ${TIER_META[next].label}`;
  return { current, next, progress, hint };
}
