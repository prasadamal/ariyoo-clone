import { capitalizeWords } from '../../src/lib/names';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../../src/ui/Icon';
import { SOCIAL_ENABLED } from '../../src/lib/features';

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

  // Opened before the profile had loaded (a deep link or a cold start): fill the form once it arrives,
  // so Save can never write empty fields over the real ones.
  const filled = useRef(Boolean(profile));
  useEffect(() => {
    if (filled.current || !profile) return;
    filled.current = true;
    setName(profile.display_name ?? '');
    setUsername(profile.username ?? '');
    setBio(profile.bio ?? '');
    setRegion(profile.home_region ?? '');
    setCountry(profile.home_country ?? '');
    setStyles(profile.travel_styles ?? []);
    setLanguages((profile.languages ?? []).join(', '));
  }, [profile]);

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

  const canSave = filled.current && !(busy || usernameOk === false || usernameOk === null || !bioCheck.ok);
  return (
    <Screen padded={false}>
      {/* Like a profile page: Save sits top right; the photo overlaps the banner. */}
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button mode="contained" compact buttonColor={colors.onSurface} textColor={colors.background} onPress={save} loading={busy} disabled={!canSave}>
              Save
            </Button>
          ),
        }}
      />
      <LinearGradient colors={['#1c1917', '#57534e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 110 }} />
      <Pressable
        onPress={pickAvatar}
        style={{ marginTop: -46, marginLeft: 16, alignSelf: 'flex-start', borderRadius: 50, borderWidth: 4, borderColor: colors.background }}
        accessibilityRole="button"
        accessibilityLabel="Change profile photo"
      >
        <Avatar id={profile.id} name={displayName(profile)} path={profile.avatar_path} uri={avatarUri} size={88} />
        <View style={{ position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.onSurface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="camera-outline" size={16} color={colors.background} />
        </View>
      </Pressable>
      <View style={{ gap: 10, padding: 16 }}>
        <TextInput mode="outlined" label="Name" value={name} onChangeText={t => setName(capitalizeWords(t))} maxLength={60} />
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
        {SOCIAL_ENABLED ? (
          <>
            <TextInput mode="outlined" label="Languages (comma separated)" value={languages} onChangeText={setLanguages} />
            <Text style={{ fontWeight: '700', marginTop: 6 }}>How do you travel?</Text>
            <ChipSelect multi options={TRAVEL_STYLES} value={styles} onChange={setStyles} />
            <Text style={{ color: colors.muted, fontSize: 12 }}>Used to suggest like-minded travellers.</Text>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
