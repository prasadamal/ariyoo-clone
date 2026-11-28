import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './client';

const key = (userId: string) => `wayfare_member_number_v1_${userId}`;

/**
 * Which member you are (you're our 452nd traveller → 452): the number of accounts created up to and
 * including yours. Cached on the phone so it still shows offline; null until it's been worked out once.
 */
export async function loadMemberNumber(userId: string): Promise<number | null> {
  const cached = Number(await AsyncStorage.getItem(key(userId)).catch(() => null)) || null;
  try {
    // Counted on the server: other people's profiles aren't readable from the app.
    const { data, error } = await db().rpc('my_member_number');
    const count = Number(data);
    if (error || !count) return cached;
    await AsyncStorage.setItem(key(userId), String(count)).catch(() => undefined);
    return count;
  } catch {
    return cached;
  }
}
