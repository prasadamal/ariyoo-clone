import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useAuth } from '../../src/context/AuthContext';
import { useSync } from '../../src/context/SyncContext';
import { acceptInvite, crewError, previewInvite, type InvitePreview } from '../../src/lib/crew';
import { track } from '../../src/lib/telemetry';
import { useAppTheme } from '../../src/theme';
import { Icon } from '../../src/ui/Icon';
import { Notice } from '../../src/ui/Notice';
import { Screen } from '../../src/ui/Screen';

type Phase = 'checking' | 'ready' | 'dead' | 'signin' | 'joining';

/** Where a crew invite link lands: who invited you to which journey, and a button to join. */
export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { syncNow } = useSync();
  const [phase, setPhase] = useState<Phase>('checking');
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [error, setError] = useState('');
  const busy = useRef(false);

  useEffect(() => {
    if (!user) {
      setPhase('signin');
      return;
    }
    previewInvite(String(token))
      .then(p => {
        setInvite(p);
        setPhase(p ? 'ready' : 'dead');
      })
      .catch(e => {
        setError(crewError(e));
        setPhase('dead');
      });
  }, [token, user]);

  const join = async () => {
    if (busy.current) return;
    busy.current = true;
    setPhase('joining');
    setError('');
    try {
      const tripId = await acceptInvite(String(token));
      void track('invite_joined');
      await syncNow();
      router.replace(`/trip/${tripId}`);
    } catch (e) {
      setError(crewError(e));
      setPhase('ready');
    } finally {
      busy.current = false;
    }
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginTop: 24 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="account-multiple-plus-outline" size={34} color={colors.primary} />
        </View>
        {phase === 'checking' ? <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} /> : null}
        {phase === 'signin' ? (
          <>
            <Text variant="titleLarge" style={{ fontWeight: '800', marginTop: 16, textAlign: 'center' }}>You're invited to a journey</Text>
            <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 6 }}>Sign in or create a free account to join, then open the link again.</Text>
            <Button mode="contained" style={{ marginTop: 16 }} onPress={() => router.push('/login')}>Sign in</Button>
            <Button style={{ marginTop: 6 }} onPress={() => router.push('/register')}>Create account</Button>
          </>
        ) : null}
        {(phase === 'ready' || phase === 'joining') && invite ? (
          <>
            <Text style={{ color: colors.muted, marginTop: 16 }}>{invite.invited_by} invited you to</Text>
            <Text variant="headlineSmall" style={{ fontWeight: '900', textAlign: 'center', marginTop: 4 }}>{invite.title}</Text>
            <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 6 }}>You'll see every moment, plan and expense. An admin can let you add your own.</Text>
            {error ? <Notice tone="error" text={error} /> : null}
            <Button mode="contained" icon="check" style={{ marginTop: 16, alignSelf: 'stretch' }} onPress={join} loading={phase === 'joining'} disabled={phase === 'joining'}>
              Join journey
            </Button>
            <Button style={{ marginTop: 6 }} onPress={() => router.replace('/(tabs)')}>Not now</Button>
          </>
        ) : null}
        {phase === 'dead' ? (
          <>
            <Text variant="titleMedium" style={{ fontWeight: '800', marginTop: 16, textAlign: 'center' }}>This invite link has expired</Text>
            <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 6 }}>{error || 'Ask whoever sent it for a new link.'}</Text>
            <Button style={{ marginTop: 12 }} onPress={() => router.replace('/(tabs)')}>Go to my journeys</Button>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
