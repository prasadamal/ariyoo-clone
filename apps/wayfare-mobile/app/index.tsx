import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useAuth } from '../src/context/AuthContext';
import { isOnboardingComplete } from '../src/lib/onboarding';

export default function Index() {
  const theme = useTheme();
  const { loading, session, offlineMode, guest } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    isOnboardingComplete().then(setOnboardingDone).catch(() => setOnboardingDone(true));
  }, []);

  if (loading || onboardingDone === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>Wayfare</Text>
      </View>
    );
  }

  if (!onboardingDone) return <Redirect href="/onboarding" />;
  if (offlineMode || session || guest) return <Redirect href="/(tabs)" />;
  return <Redirect href="/login" />;
}
