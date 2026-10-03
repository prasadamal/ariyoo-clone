import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Dimensions, FlatList, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { completeOnboarding } from '../src/lib/onboarding';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    title: 'Your journey, journaled',
    body: 'Capture treks and trips offline. Sync to the cloud when you are back on Wi‑Fi.',
    emoji: '📓',
  },
  {
    title: 'Everything in one trip',
    body: 'Journal with photos and mood, track budget and packing, and record your GPS route on a map.',
    emoji: '🗺️',
  },
  {
    title: 'Built for the Himalaya',
    body: 'Explore trek guides, export PDF travel logs, and keep your memories private by default.',
    emoji: '⛰️',
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const finish = async () => {
    await completeOnboarding();
    router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fafaf9', paddingTop: 48 }}>
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
            <Text style={{ fontSize: 48, marginBottom: 16 }}>{item.emoji}</Text>
            <Text variant="headlineMedium" style={{ marginBottom: 12 }}>{item.title}</Text>
            <Text variant="bodyLarge" style={{ color: '#57534e', lineHeight: 26 }}>{item.body}</Text>
          </View>
        )}
      />
      <View style={{ padding: 24, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === index ? '#c2410c' : '#d6d3d1',
              }}
            />
          ))}
        </View>
        {index < SLIDES.length - 1 ? (
          <Button
            mode="contained"
            onPress={() => listRef.current?.scrollToIndex({ index: index + 1, animated: true })}
          >
            Next
          </Button>
        ) : (
          <Button mode="contained" onPress={finish}>Get started</Button>
        )}
        <Button onPress={finish}>Skip</Button>
      </View>
    </View>
  );
}
