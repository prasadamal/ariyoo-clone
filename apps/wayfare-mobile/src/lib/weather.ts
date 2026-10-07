/** Open-Meteo (free, no key) current conditions + daily forecast, with WMO code mapping. */

export type CurrentWeather = { summary: string; tempC: number | null; code: number | null; windKmh: number | null };

export type ForecastDay = {
  date: string;
  code: number | null;
  maxC: number | null;
  minC: number | null;
  precipChance: number | null;
  sunrise: string | null;
  sunset: string | null;
};

const LABELS: Array<[number[], string, string]> = [
  [[0], 'Clear', 'weather-sunny'],
  [[1], 'Mainly clear', 'weather-sunny'],
  [[2], 'Partly cloudy', 'weather-partly-cloudy'],
  [[3], 'Overcast', 'weather-cloudy'],
  [[45, 48], 'Fog', 'weather-fog'],
  [[51, 53, 55], 'Drizzle', 'weather-rainy'],
  [[56, 57], 'Freezing drizzle', 'weather-snowy-rainy'],
  [[61, 63, 65], 'Rain', 'weather-pouring'],
  [[66, 67], 'Freezing rain', 'weather-snowy-rainy'],
  [[71, 73, 75], 'Snow', 'weather-snowy'],
  [[77], 'Snow grains', 'weather-snowy'],
  [[80, 81, 82], 'Rain showers', 'weather-rainy'],
  [[85, 86], 'Snow showers', 'weather-snowy-heavy'],
  [[95], 'Thunderstorm', 'weather-lightning'],
  [[96, 99], 'Thunderstorm with hail', 'weather-hail'],
];

export function weatherCodeLabel(code: number | null | undefined) {
  if (code == null) return 'Weather';
  return LABELS.find(([codes]) => codes.includes(code))?.[1] ?? 'Weather';
}

export function weatherCodeIcon(code: number | null | undefined) {
  if (code == null) return 'weather-partly-cloudy';
  return LABELS.find(([codes]) => codes.includes(code))?.[2] ?? 'weather-partly-cloudy';
}

export function describeWeather(code: number | null, tempC: number | null, windKmh: number | null) {
  const label = weatherCodeLabel(code);
  if (tempC == null) return label;
  return `${label}, ${Math.round(tempC)}°C${windKmh != null ? `, wind ${Math.round(windKmh)} km/h` : ''}`;
}

export async function fetchCurrentWeather(latitude: number, longitude: number): Promise<CurrentWeather | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      '&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto';
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const tempC = data?.current?.temperature_2m ?? null;
    const code = data?.current?.weather_code ?? null;
    const windKmh = data?.current?.wind_speed_10m ?? null;
    return { summary: describeWeather(code, tempC, windKmh), tempC, code, windKmh };
  } catch {
    return null;
  }
}

/** Short text for journal entries (kept for existing callers). */
export async function fetchWeatherSummary(latitude: number, longitude: number): Promise<string | null> {
  return (await fetchCurrentWeather(latitude, longitude))?.summary ?? null;
}

export async function fetchForecast(latitude: number, longitude: number, days = 7): Promise<ForecastDay[]> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset' +
      `&timezone=auto&forecast_days=${Math.min(Math.max(days, 1), 16)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const d = (await res.json())?.daily;
    if (!d?.time) return [];
    return (d.time as string[]).map((date, i) => ({
      date,
      code: d.weather_code?.[i] ?? null,
      maxC: d.temperature_2m_max?.[i] ?? null,
      minC: d.temperature_2m_min?.[i] ?? null,
      precipChance: d.precipitation_probability_max?.[i] ?? null,
      sunrise: d.sunrise?.[i] ?? null,
      sunset: d.sunset?.[i] ?? null,
    }));
  } catch {
    return [];
  }
}
