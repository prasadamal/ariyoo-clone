import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Dimensions, FlatList, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { completeOnboarding } from '../src/lib/onboarding';
import { Icon } from '../src/ui/Icon';

const { width } = Dimensions.get('window');

const SLIDES: { title: string; body: string; icon: string; colors: [string, string] }[] = [
  {
    title: 'Your journey, journaled',
    body: 'Write moments with photos, voice notes, mood and weather — fully offline. Record your GPS route and relive it on a map.',
    icon: 'notebook-edit-outline',
    colors: ['#6a01a3', '#3f0263'],
  },
  {
    title: 'Your people, found',
    body: 'See who else is heading to Kedarkantha or Spiti on your dates, find travel buddies, share cabs and stays, and join destination rooms.',
    icon: 'account-group-outline',
    colors: ['#0d9488', '#134e4a'],
  },
  {
    title: 'Plan, split, stay safe',
    body: 'Day-by-day plans, packing lists, group expenses that settle themselves, one-tap SOS and live location for the people who worry about you.',
    icon: 'shield-check-outline',
    colors: ['#7c3aed', '#2e1065'],
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const finish = async () => {
    await completeOnboarding();
    router.replace('/');
  };

  const slide = SLIDES[index];

  return (
    <LinearGradient colors={slide.colors} style={{ flex: 1 }}>
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
            <View style={{ width: 88, height: 88, borderRadius: 28, backgroundColor: '#ffffff26', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <Icon name={item.icon} size={46} color="#fff" />
            </View>
            <Text variant="displaySmall" style={{ color: '#fff', fontWeight: '800', marginBottom: 14 }}>
              {item.title}
            </Text>
            <Text variant="titleMedium" style={{ color: '#ffffffd9', lineHeight: 26 }}>
              {item.body}
            </Text>
          </View>
        )}
      />
      <View style={{ padding: 24, paddingBottom: 40, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          {SLIDES.map((_, i) => (
            <View key={i} style={{ width: i === index ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === index ? '#fff' : '#ffffff66' }} />
          ))}
        </View>
        {index < SLIDES.length - 1 ? (
          <Button
            mode="contained"
            buttonColor="#fff"
            textColor={slide.colors[1]}
            onPress={() => listRef.current?.scrollToIndex({ index: index + 1, animated: true })}
          >
            Next
          </Button>
        ) : (
          <Button mode="contained" buttonColor="#fff" textColor={slide.colors[1]} onPress={finish}>
            Start exploring
          </Button>
        )}
        <Button textColor="#fff" onPress={finish}>
          Skip
        </Button>
      </View>
    </LinearGradient>
  );
}
