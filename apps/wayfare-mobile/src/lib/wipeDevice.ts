import * as FileSystem from 'expo-file-system/legacy';
import { wipeLocalData } from './localDb';
import { PARTIAL_WIPE_MESSAGE, removeMediaFolders } from './mediaWipe';
import { clearPackingLists } from './packingListsStore';
import { clearPins } from './pins';
import { refreshPackingNudges } from './packingReminders';
import { clearSafetyData } from './safety';
import { clearAllUnsavedCopies } from './unsavedChangesStore';
import { clearUpiIds } from './upiIds';

/**
 * Removes every journal from this phone: database rows, then the photo / cover / voice files,
 * plus the personal details kept beside them (emergency contacts, SOS name, check-in, UPI IDs,
 * packing reminders, pinned journeys), so the next person to sign in on this phone sees none of them.
 * Safe to call again after a partial failure (every step is idempotent).
 */
export async function wipeDevice() {
  await wipeLocalData();
  await clearPackingLists().catch(() => undefined);
  await clearPins().catch(() => undefined);
  await clearSafetyData().catch(() => undefined);
  await clearUpiIds().catch(() => undefined);
  await clearAllUnsavedCopies().catch(() => undefined);
  await refreshPackingNudges([]);
  const failed = await removeMediaFolders(FileSystem, FileSystem.documentDirectory, FileSystem.cacheDirectory);
  if (failed.length) throw new Error(PARTIAL_WIPE_MESSAGE);
}
