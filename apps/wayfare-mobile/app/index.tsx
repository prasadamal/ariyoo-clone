import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAuth } from '../src/context/AuthContext';
import { isOnboardingComplete } from '../src/lib/onboarding';
import { useAppTheme } from '../src/theme';

export default function Index() {
  const { loading, session, offlineMode, guest } = useAuth();
  const { colors } = useAppTheme();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    isOnboardingComplete().then(setOnboardingDone);
  }, []);

  if (loading || onboardingDone === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.muted, fontWeight: '700', letterSpacing: 2 }}>WAYFARE</Text>
      </View>
    );
  }

  if (!onboardingDone) return <Redirect href="/onboarding" />;
  if (offlineMode || session || guest) return <Redirect href="/(tabs)" />;
  return <Redirect href="/login" />;
}
