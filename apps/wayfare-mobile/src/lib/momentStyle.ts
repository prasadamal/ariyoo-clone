/**
 * How a moment looks in the journey's Stories view (pure, for tests): the short weather shown on a
 * moment, the colour of a text-only moment from its mood, and when words are short enough to set big.
 */

export type ShortWeather = { icon: string; label: string };

const WEATHER_ICONS: [RegExp, string][] = [
  [/thunder|storm/i, 'weather-lightning-rainy'],
  [/snow|sleet|blizzard/i, 'weather-snowy'],
  [/rain|drizzle|shower/i, 'weather-rainy'],
  [/fog|mist|haze/i, 'weather-fog'],
  [/partly|few clouds|mainly clear/i, 'weather-partly-cloudy'],
  [/cloud|overcast/i, 'weather-cloudy'],
  [/clear|sunny/i, 'weather-sunny'],
];

/** "Partly cloudy, 29°C, wind 4 km/h" → a partly-cloudy icon and "29°". Null when there's nothing to show. */
export function shortWeather(weather: string | null | undefined): ShortWeather | null {
  if (!weather || !weather.trim()) return null;
  const temp = weather.match(/(-?\d+(?:\.\d+)?)\s*°/);
  const icon = WEATHER_ICONS.find(([re]) => re.test(weather))?.[1] ?? 'weather-partly-cloudy';
  if (temp) return { icon, label: `${Math.round(Number(temp[1]))}°` };
  // No temperature: the first words only ("Light rain").
  const words = weather.split(',')[0].trim();
  return words ? { icon, label: words.length > 18 ? `${words.slice(0, 17)}…` : words } : null;
}

/** Words short enough to set as a big line ("Woohoooo", "Meghana again"). */
export function isShortMoment(body: string): boolean {
  const t = body.trim();
  return t.length > 0 && t.length <= 28 && !t.includes('\n');
}

export type Tint = { bg: string; fg: string; chip: string };

// A text-only moment's card takes its mood's colour; no mood: the brand's lavender.
const TINTS: Record<string, { light: Tint; dark: Tint }> = {
  wow: { light: { bg: '#fff1dc', fg: '#7a3e00', chip: '#ffffffa6' }, dark: { bg: '#3a2410', fg: '#ffd9a8', chip: '#00000040' } },
  great: { light: { bg: '#e6f6ea', fg: '#14532d', chip: '#ffffffa6' }, dark: { bg: '#12301e', fg: '#bdecc9', chip: '#00000040' } },
  happy: { light: { bg: '#e6f6ea', fg: '#14532d', chip: '#ffffffa6' }, dark: { bg: '#12301e', fg: '#bdecc9', chip: '#00000040' } },
  grateful: { light: { bg: '#fde8ef', fg: '#831843', chip: '#ffffffa6' }, dark: { bg: '#3a1424', fg: '#f9c2d6', chip: '#00000040' } },
  tough: { light: { bg: '#fff6d6', fg: '#713f12', chip: '#ffffffa6' }, dark: { bg: '#33280c', fg: '#f6dc8f', chip: '#00000040' } },
  calm: { light: { bg: '#e0f5f1', fg: '#134e4a', chip: '#ffffffa6' }, dark: { bg: '#0f2e2a', fg: '#b4e8dd', chip: '#00000040' } },
  epic: { light: { bg: '#ffe7dc', fg: '#7c2d12', chip: '#ffffffa6' }, dark: { bg: '#3a1a0e', fg: '#ffc7ad', chip: '#00000040' } },
  cold: { light: { bg: '#e0f2fe', fg: '#075985', chip: '#ffffffa6' }, dark: { bg: '#0c2a3d', fg: '#b3e0fb', chip: '#00000040' } },
  hot: { light: { bg: '#fee2e2', fg: '#7f1d1d', chip: '#ffffffa6' }, dark: { bg: '#3a1414', fg: '#fbc4c4', chip: '#00000040' } },
  tired: { light: { bg: '#eeeef2', fg: '#3f3f46', chip: '#ffffffa6' }, dark: { bg: '#26262c', fg: '#d4d4d8', chip: '#00000040' } },
};
const DEFAULT_TINT = { light: { bg: '#f1e4f9', fg: '#3f0263', chip: '#ffffffa6' }, dark: { bg: '#2a1838', fg: '#e3c6f7', chip: '#00000040' } };

/** "😊 Great" → that mood's card colours (light or dark theme). */
export function moodTint(mood: string | null | undefined, dark: boolean): Tint {
  const word = (mood ?? '').split(' ').slice(1).join(' ').trim().toLowerCase();
  const t = TINTS[word] ?? DEFAULT_TINT;
  return dark ? t.dark : t.light;
}

/** Long words fold after a few lines behind "Read more". */
export function foldsMoment(body: string, chars = 220, lines = 4): boolean {
  return body.length > chars || body.split('\n').length > lines;
}
