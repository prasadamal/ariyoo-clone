import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAuth } from '../src/context/AuthContext';
import { isOnboardingComplete } from '../src/lib/onboarding';

export default function Index() {
  const { loading, session, offlineMode } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    isOnboardingComplete().then(setOnboardingDone);
  }, []);

  if (loading || onboardingDone === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafaf9' }}>
        <ActivityIndicator color="#c2410c" />
        <Text style={{ marginTop: 12, color: '#57534e' }}>Wayfare</Text>
      </View>
    );
  }

  if (!onboardingDone) return <Redirect href="/onboarding" />;
  if (offlineMode || session) return <Redirect href="/(tabs)" />;
  return <Redirect href="/login" />;
}
