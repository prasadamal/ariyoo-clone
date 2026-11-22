/**
 * Achievement badges, computed from journal stats (pure). Each badge is a family with levels you climb
 * by a plain rule ("1,000 km, then 10,000, then 50,000…"), so a few badges stay meaningful for years
 * instead of many one-offs. Weather badges and the altitude one-offs were dropped: they were luck, not
 * travel.
 */
import type { TravelStats } from './travelStats';

export type BadgeDef = {
  id: string;
  title: string;
  /** What the badge counts, in plain words, used as "{noun}: 3 of 5". */
  noun: string;
  icon: string;
  /** Level thresholds, lowest first. */
  levels: number[];
  metric: (s: TravelStats) => number;
  unit?: string;
};

export type Badge = {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  /** 0 = not earned yet; 1 … levels.length. */
  level: number;
  maxLevel: number;
  value: number;
  /** The next threshold (or the top one once maxed). */
  target: number;
  /** Progress from the current level towards the next (1 when maxed). */
  progress: number;
  earned: boolean;
  unit?: string;
};

// Level colours: bronze, silver, gold, platinum. Not earned yet uses the theme's grey on screen.
export const LEVEL_COLORS = ['#b45309', '#64748b', '#ca8a04', '#0f766e'];
export const LEVEL_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum'];

export const BADGES: BadgeDef[] = [
  { id: 'distance', title: 'Road Runner', noun: 'Kilometres travelled', icon: 'map-marker-distance', levels: [1000, 10000, 50000, 100000], metric: s => s.kmTravelled, unit: 'km' },
  { id: 'journeys', title: 'First Steps', noun: 'Journeys', icon: 'shoe-print', levels: [1, 10, 50], metric: s => s.trips },
  { id: 'explorer', title: 'Explorer', noun: 'Places', icon: 'compass-rose', levels: [5, 15, 30], metric: s => s.destinations },
  { id: 'countries', title: 'Globetrotter', noun: 'Countries', icon: 'earth', levels: [2, 5, 10], metric: s => s.countryCodes.length },
  { id: 'states', title: 'State Hopper', noun: 'States', icon: 'map-legend', levels: [3, 10, 20], metric: s => s.states.length },
  { id: 'moments', title: 'Storyteller', noun: 'Moments', icon: 'feather', levels: [25, 100, 500], metric: s => s.entries },
  { id: 'photos', title: 'Shutterbug', noun: 'Photos', icon: 'camera-iris', levels: [50, 250, 1000], metric: s => s.photos },
  { id: 'streak', title: 'Daily Diarist', noun: 'Days in a row', icon: 'fire', levels: [7, 30, 100], metric: s => s.longestStreakDays, unit: 'days' },
  { id: 'climber', title: 'Climber', noun: 'Metres climbed', icon: 'stairs-up', levels: [3000, 10000, 30000], metric: s => s.elevationGainM, unit: 'm' },
  { id: 'long-trip', title: 'Long Haul', noun: 'Longest journey', icon: 'calendar-range', levels: [7, 14, 30], metric: s => s.longestTripDays, unit: 'days' },
];

const ROMAN = ['I', 'II', 'III', 'IV'];
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

export function computeBadges(stats: TravelStats): Badge[] {
  return BADGES.map(def => {
    const value = Math.max(0, def.metric(stats) || 0);
    const level = def.levels.filter(t => value >= t).length;
    const maxed = level === def.levels.length;
    const floor = level ? def.levels[level - 1] : 0;
    const target = maxed ? def.levels[def.levels.length - 1] : def.levels[level];
    const progress = maxed ? 1 : Math.min(1, Math.max(0, (value - floor) / (target - floor)));
    const unit = def.unit ? ` ${def.unit}` : '';
    const description = maxed
      ? `${def.noun}: ${fmt(value)}${unit}. Top level.`
      : `${def.noun}: ${fmt(value)} of ${fmt(target)}${unit} for ${LEVEL_NAMES[level]}`;
    return {
      id: def.id,
      title: level ? `${def.title} ${ROMAN[level - 1]}` : def.title,
      description,
      icon: def.icon,
      color: LEVEL_COLORS[Math.max(0, level - 1)],
      level,
      maxLevel: def.levels.length,
      value,
      target,
      progress,
      earned: level > 0,
      unit: def.unit,
    };
  });
}

/** Earned first (highest level first), then closest to their next level. */
export function sortBadges(badges: Badge[]) {
  return [...badges].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    if (a.level !== b.level) return b.level - a.level;
    return b.progress - a.progress;
  });
}
