import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useSync } from '../../src/context/SyncContext';
import { JournalTab } from '../../src/features/trip/JournalTab';
import { ensureEverydayTrip } from '../../src/lib/everyday';
import type { LocalTrip } from '../../src/lib/localDb';
import { useAppTheme } from '../../src/theme';
import { Icon } from '../../src/ui/Icon';
import { Screen } from '../../src/ui/Screen';
import { TAB_BAR_SPACE } from '../../src/ui/GlassTabBar';

/** The private journal for ordinary days: same composer as a journey, no trip needed. */
export default function EverydayJournalScreen() {
  const { colors } = useAppTheme();
  const { refreshPending } = useSync();
  const [trip, setTrip] = useState<LocalTrip | null>(null);
  const [failed, setFailed] = useState(false);

  const open = useCallback(() => {
    setFailed(false);
    ensureEverydayTrip().then(setTrip, () => setFailed(true));
  }, []);

  useEffect(open, [open]);

  if (failed) {
    return (
      <Screen bottomSpace={TAB_BAR_SPACE}>
        <Text variant="titleMedium">Your journal could not be opened.</Text>
        <Text style={{ color: colors.muted, marginTop: 6 }}>Nothing was lost. Please try again.</Text>
        <Button mode="contained" onPress={open} style={{ marginTop: 16, alignSelf: 'flex-start' }}>
          Try again
        </Button>
      </Screen>
    );
  }
  if (!trip) return <ActivityIndicator style={{ marginTop: 40 }} accessibilityLabel="Opening your journal" />;

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <Screen bottomSpace={TAB_BAR_SPACE}>
      <View style={{ marginBottom: 14 }}>
        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>{today.toUpperCase()}</Text>
        <Text variant="headlineSmall" accessibilityRole="header" style={{ fontWeight: '800', marginTop: 2 }}>
          Everyday journal
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <Icon name="lock-outline" size={14} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 13, flex: 1 }}>Private to you · works offline · backed up when you sign in</Text>
        </View>
      </View>
      <JournalTab trip={trip} onChanged={refreshPending} everyday />
    </Screen>
  );
}
