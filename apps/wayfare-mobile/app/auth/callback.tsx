import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { parseAuthUrl } from '../../src/lib/authLink';
import { supabase } from '../../src/lib/supabase';

/** Landing screen for wayfare://auth/callback (email confirmation and password recovery links). */
export default function AuthCallback() {
  const theme = useTheme();
  const url = Linking.useLinkingURL();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!url) return;
    (async () => {
      const link = parseAuthUrl(url);
      if (!link || !supabase) return router.replace('/');
      if (link.error) return setError(link.error);
      try {
        if (link.accessToken && link.refreshToken) {
          const { error: e } = await supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
          if (e) throw e;
        } else if (link.code) {
          const { error: e } = await supabase.auth.exchangeCodeForSession(link.code);
          if (e) throw e;
        } else {
          return router.replace('/');
        }
        router.replace(link.type === 'recovery' ? '/reset-password' : '/(tabs)');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'This link is invalid or has expired.');
      }
    })();
  }, [url]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: theme.colors.background }}>
      {error ? (
        <>
          <Text variant="titleLarge">Link problem</Text>
          <Text style={{ marginVertical: 12, textAlign: 'center', color: theme.colors.onSurfaceVariant }}>{error}</Text>
          <Button mode="contained" onPress={() => router.replace('/login')}>Back to sign in</Button>
        </>
      ) : (
        <ActivityIndicator />
      )}
    </View>
  );
}
