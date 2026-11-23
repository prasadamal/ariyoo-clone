import * as FileSystem from 'expo-file-system/legacy';
import { wipeLocalData } from './localDb';
import { PARTIAL_WIPE_MESSAGE, removeMediaFolders } from './mediaWipe';
import { clearPackingLists } from './packingListsStore';

/**
 * Removes every journal from this phone: database rows, then the photo / cover / voice files.
 * Safe to call again after a partial failure (both steps are idempotent).
 */
export async function wipeDevice() {
  await wipeLocalData();
  await clearPackingLists().catch(() => undefined);
  const failed = await removeMediaFolders(FileSystem, FileSystem.documentDirectory, FileSystem.cacheDirectory);
  if (failed.length) throw new Error(PARTIAL_WIPE_MESSAGE);
}
