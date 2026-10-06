import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export type PickedPhoto = { uri: string; width?: number; height?: number };

async function fromCamera(): Promise<PickedPhoto[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Camera permission is needed to take photos.');
  const res = await ImagePicker.launchCameraAsync({ quality: 0.9 });
  if (res.canceled) return [];
  return res.assets.map(a => ({ uri: a.uri, width: a.width, height: a.height }));
}

async function fromLibrary(multiple: boolean): Promise<PickedPhoto[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Photo library permission is needed to add photos.');
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.9,
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? 10 : 1,
  });
  if (res.canceled) return [];
  return res.assets.map(a => ({ uri: a.uri, width: a.width, height: a.height }));
}

/** Asks camera vs library, resolves with the picked photos (empty when cancelled). */
export function pickPhotos(multiple = true): Promise<PickedPhoto[]> {
  return new Promise((resolve, reject) => {
    Alert.alert('Add photos', undefined, [
      { text: 'Take photo', onPress: () => fromCamera().then(resolve, reject) },
      { text: 'Choose from library', onPress: () => fromLibrary(multiple).then(resolve, reject) },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve([]) },
    ]);
  });
}
