import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../../src/context/AuthContext';
import { useToast } from '../../src/context/ToastContext';
import { screenText } from '../../src/lib/contentFilter';
import { displayName } from '../../src/lib/format';
import { db } from '../../src/social/client';
import { normalizeUsername, updateMyProfile, uploadAvatar, usernameAvailable } from '../../src/social/profiles';
import { TRAVEL_STYLES } from '../../src/social/types';
import { useAppTheme } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { ChipSelect } from '../../src/ui/ChipSelect';
import { Screen } from '../../src/ui/Screen';

export default function EditProfileScreen() {
  const { colors } = useAppTheme();
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [usernameOk, setUsernameOk] = useState<boolean | null>(true);
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [region, setRegion] = useState(profile?.home_region ?? '');
  const [country, setCountry] = useState(profile?.home_country ?? '');
  const [styles, setStyles] = useState<string[]>(profile?.travel_styles ?? []);
  const [languages, setLanguages] = useState((profile?.languages ?? []).join(', '));
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarSize, setAvatarSize] = useState<{ width?: number; height?: number } | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!username || username === profile?.username) {
      setUsernameOk(true);
      return;
    }
    if (!/^[a-z0-9_.]{3,24}$/.test(username)) {
      setUsernameOk(false);
      return;
    }
    setUsernameOk(null);
    const t = setTimeout(() => usernameAvailable(username).then(setUsernameOk).catch(() => setUsernameOk(null)), 400);
    return () => clearTimeout(t);
  }, [username, profile?.username]);

  if (!profile) return null;

  const pickAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
    if (res.canceled || !res.assets[0]) return;
    setAvatarUri(res.assets[0].uri);
    setAvatarSize({ width: res.assets[0].width, height: res.assets[0].height });
  };

  const bioCheck = screenText(`${name} ${bio}`);

  const save = async () => {
    if (!bioCheck.ok) return;
    setBusy(true);
    try {
      let avatar_path = profile.avatar_path;
      if (avatarUri) {
        avatar_path = await uploadAvatar(avatarUri, avatarSize);
        if (profile.avatar_path) await db().storage.from('avatars').remove([profile.avatar_path]).catch(() => undefined);
      }
      await updateMyProfile({
        display_name: name.trim() || null,
        username: username || profile.username,
        bio: bio.trim() || null,
        home_region: region.trim() || null,
        home_country: country.trim() || null,
        travel_styles: styles,
        languages: languages
          .split(',')
          .map(l => l.trim())
          .filter(Boolean)
          .slice(0, 8),
        avatar_path,
      });
      await refreshProfile();
      toast('Profile updated');
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save profile');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Pressable onPress={pickAvatar} style={{ alignItems: 'center', marginBottom: 16 }} accessibilityRole="button" accessibilityLabel="Change profile photo">
        <Avatar id={profile.id} name={displayName(profile)} path={profile.avatar_path} uri={avatarUri} size={104} ring={colors.primary} />
        <Text style={{ color: colors.primary, marginTop: 8, fontWeight: '700' }}>Change photo</Text>
      </Pressable>
      <View style={{ gap: 10 }}>
        <TextInput mode="outlined" label="Name" value={name} onChangeText={setName} maxLength={60} />
        <TextInput
          mode="outlined"
          label="Username"
          value={username}
          onChangeText={t => setUsername(normalizeUsername(t))}
          autoCapitalize="none"
          left={<TextInput.Affix text="@" />}
          error={usernameOk === false}
        />
        {usernameOk === false ? <HelperText type="error">Taken or invalid (3–24: a–z, 0–9, . and _)</HelperText> : null}
        <TextInput mode="outlined" label="Bio" value={bio} onChangeText={setBio} multiline maxLength={280} />
        <HelperText type={bioCheck.ok ? 'info' : 'error'}>{bioCheck.ok ? `${bio.length}/280` : bioCheck.reason}</HelperText>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TextInput mode="outlined" label="Home region / city" value={region} onChangeText={setRegion} style={{ flex: 1 }} />
          <TextInput mode="outlined" label="Country" value={country} onChangeText={setCountry} style={{ flex: 1 }} />
        </View>
        <TextInput mode="outlined" label="Languages (comma separated)" value={languages} onChangeText={setLanguages} />
        <Text style={{ fontWeight: '700', marginTop: 6 }}>How do you travel?</Text>
        <ChipSelect multi options={TRAVEL_STYLES} value={styles} onChange={setStyles} />
        <Text style={{ color: colors.muted, fontSize: 12 }}>Used to suggest like-minded travellers.</Text>
        <Button mode="contained" onPress={save} loading={busy} disabled={busy || usernameOk === false || usernameOk === null || !bioCheck.ok} style={{ marginTop: 10 }}>
          Save profile
        </Button>
      </View>
    </Screen>
  );
}
