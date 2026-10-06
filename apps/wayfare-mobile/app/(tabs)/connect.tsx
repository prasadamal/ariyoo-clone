import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GuidelinesGate } from '../../src/components/GuidelinesGate';
import { BoardSection } from '../../src/features/connect/BoardSection';
import { MatchesSection } from '../../src/features/connect/MatchesSection';
import { NearbySection } from '../../src/features/connect/NearbySection';
import { RoomsSection } from '../../src/features/connect/RoomsSection';
import { useAppTheme } from '../../src/theme';
import { TabStrip, type TabItem } from '../../src/ui/TabStrip';

type Section = 'board' | 'nearby' | 'matches' | 'rooms';

const SECTIONS: TabItem<Section>[] = [
  { value: 'board', label: 'Board', icon: 'bulletin-board' },
  { value: 'nearby', label: 'Nearby', icon: 'radar' },
  { value: 'matches', label: 'My trips', icon: 'calendar-account-outline' },
  { value: 'rooms', label: 'Rooms', icon: 'forum-outline' },
];

export default function ConnectTab() {
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ placeKey?: string; section?: string }>();
  const [section, setSection] = useState<Section>('board');

  useEffect(() => {
    if (params.placeKey) setSection('board');
    if (params.section && SECTIONS.some(s => s.value === params.section)) setSection(params.section as Section);
  }, [params.placeKey, params.section]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GuidelinesGate what="meet travellers">
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
          <TabStrip tabs={SECTIONS} value={section} onChange={setSection} />
        </View>
        <View style={{ flex: 1 }}>
          {section === 'board' ? <BoardSection initialPlaceKey={params.placeKey ? String(params.placeKey) : null} /> : null}
          {section === 'nearby' ? <NearbySection /> : null}
          {section === 'matches' ? <MatchesSection /> : null}
          {section === 'rooms' ? <RoomsSection /> : null}
        </View>
      </GuidelinesGate>
    </View>
  );
}
