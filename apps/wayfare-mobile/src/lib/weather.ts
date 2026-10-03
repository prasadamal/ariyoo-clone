/** Free weather snapshot via Open-Meteo (no API key). */
export async function fetchWeatherSummary(latitude: number, longitude: number): Promise<string | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      '&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto';
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const t = data?.current?.temperature_2m;
    const code = data?.current?.weather_code;
    const wind = data?.current?.wind_speed_10m;
    const label = weatherCodeLabel(code);
    if (t == null) return label;
    return `${label}, ${Math.round(t)}°C${wind != null ? `, wind ${Math.round(wind)} km/h` : ''}`;
  } catch {
    return null;
  }
}

function weatherCodeLabel(code: number | undefined) {
  if (code == null) return 'Weather';
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  return 'Storm';
}
