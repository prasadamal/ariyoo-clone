import { ChipSelect } from '../ui/ChipSelect';

export const MOODS = ['😊 Great', '😌 Calm', '😮 Wow', '🔥 Epic', '😴 Tired', '🥶 Cold', '🥵 Hot', '😅 Tough', '🥹 Grateful'];

export function MoodChips({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  return (
    <ChipSelect
      scroll
      allowDeselect
      value={value || null}
      onChange={v => onChange(v)}
      options={MOODS.map(m => ({ value: m, label: m }))}
    />
  );
}
