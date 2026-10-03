import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, useWindowDimensions, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { completeOnboarding } from '../src/lib/onboarding';

const SLIDES = [
  { title: 'Your journey, journaled', body: 'Capture treks and trips offline. Your journal syncs to your private cloud backup when you are back online.', emoji: '📓' },
  { title: 'Everything in one trip', body: 'Write entries with photos, voice notes and mood, track your budget and packing, and record your GPS route on a map.', emoji: '🗺️' },
  { title: 'Private by default', body: 'Nothing is shared unless you create a link — and you can turn it off any time. Add an app lock for extra privacy.', emoji: '🔒' },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const finish = async () => {
    await completeOnboarding();
    router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: 48 }}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={e => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width, padding: 32, justifyContent: 'center', flex: 1 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }} accessibilityElementsHidden>{item.emoji}</Text>
            <Text variant="headlineMedium" style={{ marginBottom: 12 }}>{item.title}</Text>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 26 }}>{item.body}</Text>
          </View>
        )}
      />
      <View style={{ padding: 24, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          {SLIDES.map((_, i) => (
            <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === index ? theme.colors.primary : theme.colors.outlineVariant }} />
          ))}
        </View>
        {index < SLIDES.length - 1 ? (
          <Button mode="contained" onPress={() => listRef.current?.scrollToIndex({ index: index + 1, animated: true })}>Next</Button>
        ) : (
          <Button mode="contained" onPress={finish}>Get started</Button>
        )}
        <Button onPress={finish}>Skip</Button>
      </View>
    </View>
  );
}
