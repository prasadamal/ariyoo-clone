import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Rates } from './currencyMath';

const CACHE_KEY = 'wayfare_fx_rates_v1';
const MAX_AGE_MS = 12 * 3600_000;

export type RatesSnapshot = { rates: Rates; fetchedAt: string; source: string };

let memory: RatesSnapshot | null = null;

async function readCache(): Promise<RatesSnapshot | null> {
  if (memory) return memory;
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    memory = JSON.parse(raw) as RatesSnapshot;
    return memory;
  } catch {
    return null;
  }
}

async function fetchFresh(): Promise<RatesSnapshot | null> {
  // Primary: open.er-api.com (≈160 currencies incl. NPR, LKR, VND). Fallback: ECB via Frankfurter.
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (res.ok) {
      const json = await res.json();
      if (json?.result === 'success' && json.rates) {
        return { rates: json.rates as Rates, fetchedAt: new Date().toISOString(), source: 'ExchangeRate-API' };
      }
    }
  } catch {
    // try fallback
  }
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD');
    if (res.ok) {
      const json = await res.json();
      if (json?.rates) {
        return {
          rates: { USD: 1, ...(json.rates as Rates) },
          fetchedAt: new Date().toISOString(),
          source: 'European Central Bank',
        };
      }
    }
  } catch {
    // offline
  }
  return null;
}

/** Cached exchange rates (refreshed every 12h when online; stale cache beats nothing offline). */
export async function getRates(forceRefresh = false): Promise<RatesSnapshot | null> {
  const cached = await readCache();
  const fresh = cached && Date.now() - new Date(cached.fetchedAt).getTime() < MAX_AGE_MS;
  if (fresh && !forceRefresh) return cached;
  const next = await fetchFresh();
  if (next) {
    memory = next;
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next));
    return next;
  }
  return cached;
}
