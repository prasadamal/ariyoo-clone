/** Packing nudges before a journey (pure, unit-tested): when they fire, what they say, a weather tip. */
import type { ForecastDay } from './weather';

export type NudgeKind = 'three-days' | 'evening-before';
export type NudgePlan = { kind: NudgeKind; at: Date };

/** 9 am three days before the start, and 7 pm the evening before. Only ones still in the future. */
export function nudgePlan(startsOn: string, now = new Date()): NudgePlan[] {
  const [y, m, d] = startsOn.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return [];
  const plans: NudgePlan[] = [
    { kind: 'three-days', at: new Date(y, m - 1, d - 3, 9, 0, 0) },
    { kind: 'evening-before', at: new Date(y, m - 1, d - 1, 19, 0, 0) },
  ];
  return plans.filter(p => p.at.getTime() > now.getTime());
}

export type WeatherTip = { item: string; why: string };

const RAIN_CODES = new Set([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

/**
 * One thing to pack from the trip's forecast, most useful first: rain, snow, cold, then heat.
 * days: the forecast for the trip's dates, in order (Day 1 first).
 */
export function weatherTip(days: ForecastDay[]): WeatherTip | null {
  const label = (i: number) => `Day ${i + 1}`;
  const rain = days.findIndex(d => (d.precipChance ?? 0) >= 50 || (d.code != null && RAIN_CODES.has(d.code)));
  if (rain >= 0) return { item: 'Rain jacket', why: `Rain is likely on ${label(rain)}${days[rain].precipChance ? ` (${days[rain].precipChance}%)` : ''}.` };
  const snow = days.findIndex(d => d.code != null && SNOW_CODES.has(d.code));
  if (snow >= 0) return { item: 'Warm gloves', why: `Snow is forecast on ${label(snow)}.` };
  const cold = days.findIndex(d => d.minC != null && d.minC <= 8);
  if (cold >= 0) return { item: 'Warm layer', why: `Nights drop to ${Math.round(days[cold].minC!)}° on ${label(cold)}.` };
  const hot = days.findIndex(d => d.maxC != null && d.maxC >= 32);
  if (hot >= 0) return { item: 'Sunscreen', why: `${Math.round(days[hot].maxC!)}° on ${label(hot)}.` };
  return null;
}

/** The notification text. left = things still to pack (null when there's no checklist). */
export function nudgeContent(kind: NudgeKind, title: string, left: number | null, tip: WeatherTip | null) {
  const when = kind === 'three-days' ? 'in 3 days' : 'tomorrow';
  const packing = left == null ? 'Time to start packing.' : left === 0 ? 'Everything is packed. Nice.' : `${left} ${left === 1 ? 'thing' : 'things'} left to pack.`;
  return { title: `${title} ${when}`, body: tip ? `${packing} ${tip.why.replace(/\.$/, '')}: pack a ${tip.item.toLowerCase()}.` : packing };
}

/** The forecast days that fall inside the trip, Day 1 first. */
export function tripForecast(forecast: ForecastDay[], startsOn: string, endsOn: string | null): ForecastDay[] {
  const end = endsOn && endsOn >= startsOn ? endsOn : startsOn;
  return forecast.filter(d => d.date >= startsOn.slice(0, 10) && d.date <= end.slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date));
}
