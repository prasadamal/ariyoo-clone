import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { DatePickerModal, en, registerTranslation } from 'react-native-paper-dates';
import { formatDateRange, parseDay, toDayString } from '../lib/format';
import { useAppTheme } from '../theme';

registerTranslation('en', en);

type Props = {
  startsOn: string | null;
  endsOn: string | null;
  onChange: (range: { startsOn: string | null; endsOn: string | null }) => void;
  label?: string;
};

/**
 * Start and end date picked on ONE calendar: tap the first day, then the last day. A single day
 * (tap it twice) is a one-day trip. Days are stored as YYYY-MM-DD.
 */
export function DateRangeField({ startsOn, endsOn, onChange, label = 'Dates' }: Props) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const text = startsOn || endsOn ? formatDateRange(startsOn, endsOn) : '';

  return (
    <View>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}: ${text || 'not set'}. Opens a calendar.`}>
        <View pointerEvents="none">
          <TextInput
            mode="outlined"
            label={label}
            placeholder="Choose start and end"
            value={text}
            editable={false}
            right={<TextInput.Icon icon="calendar-range" />}
          />
        </View>
      </Pressable>
      {text ? (
        <Button compact style={{ alignSelf: 'flex-end', marginTop: -4 }} textColor={colors.muted} onPress={() => onChange({ startsOn: null, endsOn: null })}>
          Clear dates
        </Button>
      ) : null}
      <DatePickerModal
        locale="en"
        mode="range"
        visible={open}
        onDismiss={() => setOpen(false)}
        startDate={parseDay(startsOn) ?? undefined}
        endDate={parseDay(endsOn) ?? undefined}
        label="Select the journey's dates"
        saveLabel="Done"
        startLabel="Start"
        endLabel="End"
        onConfirm={({ startDate, endDate }) => {
          setOpen(false);
          const start = startDate ? toDayString(startDate) : null;
          onChange({ startsOn: start, endsOn: endDate ? toDayString(endDate) : start });
        }}
      />
    </View>
  );
}
