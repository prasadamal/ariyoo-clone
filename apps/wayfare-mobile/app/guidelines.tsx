import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { TERMS_URL } from '../src/config';
import { GUIDELINES, GUIDELINES_AGREEMENT } from '../src/content/guidelines';
import { useAuth } from '../src/context/AuthContext';
import { useToast } from '../src/context/ToastContext';
import { updateMyProfile } from '../src/social/profiles';
import { useAppTheme } from '../src/theme';
import { Icon } from '../src/ui/Icon';
import { Screen } from '../src/ui/Screen';

export default function GuidelinesScreen() {
  const { colors } = useAppTheme();
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const accepted = !!profile?.guidelines_accepted_at;

  const accept = async () => {
    setBusy(true);
    try {
      await updateMyProfile({ guidelines_accepted_at: new Date().toISOString() });
      await refreshProfile();
      toast('Welcome to the Wayfare community 🎒');
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={{ color: colors.muted, marginBottom: 12, lineHeight: 21 }}>
        Wayfare connects real travellers. These rules keep it safe, kind and useful for everyone.
      </Text>
      {GUIDELINES.map(g => (
        <View key={g.title} style={{ flexDirection: 'row', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Icon name={g.icon} size={26} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', marginBottom: 2 }}>{g.title}</Text>
            <Text style={{ color: colors.onSurfaceVariant, lineHeight: 20 }}>{g.body}</Text>
          </View>
        </View>
      ))}
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 16, lineHeight: 18 }}>
        {GUIDELINES_AGREEMENT}{' '}
        <Text style={{ color: colors.primary }} onPress={() => Linking.openURL(TERMS_URL)}>
          Read the Terms of Use.
        </Text>
      </Text>
      {user && !accepted ? (
        <Button mode="contained" style={{ marginTop: 20 }} onPress={accept} loading={busy} disabled={busy}>
          I agree — let’s go
        </Button>
      ) : (
        <Button mode="outlined" style={{ marginTop: 20 }} onPress={() => router.back()}>
          Close
        </Button>
      )}
    </Screen>
  );
}
