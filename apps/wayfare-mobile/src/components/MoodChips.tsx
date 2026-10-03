import { View } from 'react-native';
import { Chip } from 'react-native-paper';

const MOODS = ['😊 Great', '😌 Calm', '😮 Wow', '😴 Tired', '🥶 Cold', '🔥 Epic'];

export function MoodChips({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
      {MOODS.map(m => (
        <Chip key={m} selected={value === m} onPress={() => onChange(value === m ? '' : m)} compact>
          {m}
        </Chip>
      ))}
    </View>
  );
}
