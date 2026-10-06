/** Achievement badges computed from journal stats (pure). */
import type { TravelStats } from './travelStats';

export type BadgeDef = {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  target: number;
  metric: (s: TravelStats) => number;
  unit?: string;
};

export type Badge = Omit<BadgeDef, 'metric'> & { value: number; progress: number; earned: boolean };

export const BADGES: BadgeDef[] = [
  { id: 'first-steps', title: 'First Steps', description: 'Start your first journey', icon: 'shoe-print', color: '#c2410c', target: 1, metric: s => s.trips },
  { id: 'storyteller', title: 'Storyteller', description: 'Write 25 journal moments', icon: 'feather', color: '#7c3aed', target: 25, metric: s => s.entries },
  { id: 'shutterbug', title: 'Shutterbug', description: 'Add 50 photos to your journals', icon: 'camera-iris', color: '#be123c', target: 50, metric: s => s.photos },
  { id: 'trail-voice', title: 'Voice of the Trail', description: 'Record 10 voice notes', icon: 'microphone-variant', color: '#0369a1', target: 10, metric: s => s.voiceNotes },
  { id: 'century', title: 'Century', description: 'Record 100 km of routes', icon: 'map-marker-path', color: '#0f766e', target: 100, metric: s => s.km, unit: 'km' },
  { id: 'long-haul', title: 'Long Haul', description: 'Record 500 km of routes', icon: 'routes', color: '#047857', target: 500, metric: s => s.km, unit: 'km' },
  { id: 'thin-air', title: 'Thin Air', description: 'Reach 4,000 m on a recorded route', icon: 'image-filter-hdr', color: '#1d4ed8', target: 4000, metric: s => s.maxAltitudeM, unit: 'm' },
  { id: 'cloud-walker', title: 'Cloud Walker', description: 'Reach 5,000 m on a recorded route', icon: 'weather-cloudy-arrow-right', color: '#4338ca', target: 5000, metric: s => s.maxAltitudeM, unit: 'm' },
  { id: 'climber', title: 'Climber', description: 'Gain 3,000 m of elevation in total', icon: 'stairs-up', color: '#a16207', target: 3000, metric: s => s.elevationGainM, unit: 'm' },
  { id: 'explorer', title: 'Explorer', description: 'Journal 5 different destinations', icon: 'compass-rose', color: '#c2410c', target: 5, metric: s => s.destinations },
  { id: 'globetrotter', title: 'Globetrotter', description: 'Travel in 3 countries', icon: 'earth', color: '#0f766e', target: 3, metric: s => s.countries },
  { id: 'marathon', title: 'Marathon Trip', description: 'Journal a trip of 10+ days', icon: 'calendar-range', color: '#9333ea', target: 10, metric: s => s.longestTripDays, unit: 'days' },
  { id: 'streak', title: 'Daily Diarist', description: 'Journal 7 days in a row', icon: 'fire', color: '#ea580c', target: 7, metric: s => s.longestStreakDays, unit: 'days' },
  { id: 'finisher', title: 'Finisher', description: 'Complete 5 trips', icon: 'flag-checkered', color: '#15803d', target: 5, metric: s => s.completedTrips },
  { id: 'early-bird', title: 'Early Bird', description: 'Write an entry before 6 am', icon: 'weather-sunset-up', color: '#d97706', target: 1, metric: s => s.earlyBirdEntries },
  { id: 'night-owl', title: 'Night Owl', description: 'Write an entry after 11 pm', icon: 'owl', color: '#475569', target: 1, metric: s => s.nightOwlEntries },
  { id: 'snow-chaser', title: 'Snow Chaser', description: 'Journal a moment in the snow', icon: 'snowflake', color: '#0ea5e9', target: 1, metric: s => s.snowEntries },
  { id: 'monsoon-soul', title: 'Monsoon Soul', description: 'Journal a moment in the rain', icon: 'weather-pouring', color: '#2563eb', target: 1, metric: s => s.rainEntries },
];

export function computeBadges(stats: TravelStats): Badge[] {
  return BADGES.map(({ metric, ...def }) => {
    const value = Math.max(0, metric(stats));
    const progress = def.target > 0 ? Math.min(1, value / def.target) : 0;
    return { ...def, value, progress, earned: value >= def.target };
  });
}

/** Earned first (most recent-feeling: highest target first), then closest to earning. */
export function sortBadges(badges: Badge[]) {
  return [...badges].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    if (a.earned) return b.target - a.target;
    return b.progress - a.progress;
  });
}
