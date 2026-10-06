import { Image } from 'expo-image';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { colorForId, initials } from '../lib/format';
import { publicUrl } from '../lib/upload';

type Props = {
  id?: string | null;
  name?: string | null;
  /** Storage path in the public `avatars` bucket. */
  path?: string | null;
  /** Already-resolved URI (e.g. a just-picked local image). */
  uri?: string | null;
  size?: number;
  ring?: string;
};

export function avatarUri(path: string | null | undefined) {
  return publicUrl('avatars', path);
}

export function Avatar({ id, name, path, uri, size = 40, ring }: Props) {
  const src = uri ?? avatarUri(path);
  const ringStyle = ring ? { borderWidth: 2, borderColor: ring } : null;
  if (src) {
    return (
      <Image
        source={{ uri: src }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, ringStyle]}
        contentFit="cover"
        transition={150}
        accessibilityLabel={name ? `${name}'s photo` : 'Profile photo'}
      />
    );
  }
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colorForId(id ?? name ?? ''),
          alignItems: 'center',
          justifyContent: 'center',
        },
        ringStyle,
      ]}
      accessibilityLabel={name ?? 'Traveller'}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: Math.max(11, size * 0.38) }}>{initials(name)}</Text>
    </View>
  );
}
