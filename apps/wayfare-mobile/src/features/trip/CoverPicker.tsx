import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useToast } from '../../context/ToastContext';
import { persistCoverPhoto } from '../../lib/media';
import { useAppTheme } from '../../theme';
import { Icon } from '../../ui/Icon';
import { pickPhotos } from './photoPicker';

/** Choose, change or remove a journey's cover photo. The photo stays on this phone. */
export function CoverPicker({ value, onChange }: { value: string | null; onChange: (uri: string | null) => void }) {
  const { colors } = useAppTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const choose = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const [photo] = await pickPhotos(false);
      if (photo) onChange(await persistCoverPhoto(photo.uri, photo));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add the cover photo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontWeight: '600' }}>Cover photo</Text>
      <Pressable
        onPress={choose}
        accessibilityRole="button"
        accessibilityLabel={value ? 'Change the cover photo' : 'Add a cover photo'}
        style={{ height: 130, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}
      >
        {value ? (
          <Image source={{ uri: value }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Icon name="image-plus" size={30} color={colors.muted} />
            <Text style={{ color: colors.muted }}>Add a cover photo</Text>
          </View>
        )}
      </Pressable>
      {value ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Button compact icon="image-edit-outline" onPress={choose} loading={busy}>
            Change
          </Button>
          <Button compact icon="delete-outline" textColor={colors.danger} onPress={() => onChange(null)}>
            Remove
          </Button>
        </View>
      ) : null}
    </View>
  );
}
