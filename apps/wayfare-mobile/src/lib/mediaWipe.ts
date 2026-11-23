/**
 * Removing journals from a phone must remove the files too, not just the database rows.
 * Photos, covers and voice notes live in app folders (see upload.persistFile); picker/recorder
 * copies sit in the cache. Pure so it can be tested without a device.
 */
export const MEDIA_FOLDERS = ['journal', 'covers', 'voice'] as const;
/** Temporary copies made by the photo picker, image resizer and voice recorder. Best effort. */
export const CACHE_FOLDERS = ['ImagePicker', 'ImageManipulator', 'Audio'] as const;

export type WipeFs = {
  deleteAsync: (uri: string, opts: { idempotent: true }) => Promise<void>;
  getInfoAsync: (uri: string) => Promise<{ exists: boolean }>;
};

/** Deletes the media folders and checks they're gone. Returns the folders that are still there. */
export async function removeMediaFolders(fs: WipeFs, documentDir: string | null, cacheDir: string | null) {
  const failed: string[] = [];
  if (documentDir) {
    for (const folder of MEDIA_FOLDERS) {
      const uri = `${documentDir}${folder}/`;
      try {
        await fs.deleteAsync(uri, { idempotent: true });
        if ((await fs.getInfoAsync(uri)).exists) failed.push(folder);
      } catch {
        failed.push(folder);
      }
    }
  }
  if (cacheDir) {
    for (const folder of CACHE_FOLDERS) {
      await fs.deleteAsync(`${cacheDir}${folder}/`, { idempotent: true }).catch(() => undefined);
    }
  }
  return failed;
}

export const PARTIAL_WIPE_MESSAGE =
  'Your journals were removed, but some photos or voice notes could not be deleted from this phone. Try again.';
