import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { holdLock } from '../../lib/lockHold';
import { exifTakenAt } from '../../lib/photoTime';

/** takenAt: when the photo was taken (from the photo itself), when it says. */
export type PickedPhoto = { uri: string; width?: number; height?: number; takenAt?: string | null };

const toPicked = (a: ImagePicker.ImagePickerAsset): PickedPhoto => ({
  uri: a.uri,
  width: a.width,
  height: a.height,
  takenAt: exifTakenAt(a.exif as Record<string, unknown> | null | undefined),
});

async function fromCamera(): Promise<PickedPhoto[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Camera permission is needed to take photos.');
  const res = await holdLock(() => ImagePicker.launchCameraAsync({ quality: 0.9, exif: true }));
  if (res.canceled) return [];
  return res.assets.map(toPicked);
}

// The system photo picker needs no library permission (Android Photo Picker / iOS PHPicker).
async function fromLibrary(multiple: boolean): Promise<PickedPhoto[]> {
  const res = await holdLock(() =>
    ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsMultipleSelection: multiple,
      selectionLimit: multiple ? 10 : 1,
      exif: true,
    })
  );
  if (res.canceled) return [];
  return res.assets.map(toPicked);
}

/**
 * Asks camera vs library, resolves with the picked photos (empty when cancelled). onPicking runs as
 * soon as a source is chosen, so the screen can show it's busy while the phone hands the photos over.
 */
export function pickPhotos(multiple = true, onPicking?: () => void): Promise<PickedPhoto[]> {
  return new Promise((resolve, reject) => {
    Alert.alert('Add photos', undefined, [
      { text: 'Take photo', onPress: () => { onPicking?.(); fromCamera().then(resolve, reject); } },
      { text: 'Choose from library', onPress: () => { onPicking?.(); fromLibrary(multiple).then(resolve, reject); } },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve([]) },
    ]);
  });
}
