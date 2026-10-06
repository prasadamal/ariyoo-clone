import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { formatDay, parseDay, toDayString } from '../lib/format';
import { useAppTheme } from '../theme';

type Props = {
  label: string;
  value: string | null;
  onChange: (day: string | null) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  clearable?: boolean;
};

/** A date input backed by the native picker; stores calendar days as YYYY-MM-DD. */
export function DateField({ label, value, onChange, minimumDate, maximumDate, clearable = true }: Props) {
  const { colors, dark } = useAppTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(parseDay(value) ?? minimumDate ?? new Date());

  const open = () => {
    const current = parseDay(value) ?? minimumDate ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        minimumDate,
        maximumDate,
        onChange: (e: DateTimePickerEvent, d?: Date) => {
          if (e.type === 'set' && d) onChange(toDayString(d));
        },
      });
    } else {
      setDraft(current);
      setIosOpen(true);
    }
  };

  return (
    <>
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${label}: ${value ? formatDay(value, { year: true }) : 'not set'}`}>
        <View pointerEvents="none">
          <TextInput
            mode="outlined"
            label={label}
            value={value ? formatDay(value, { weekday: true, year: true }) : ''}
            right={
              value && clearable ? <TextInput.Icon icon="close" onPress={() => onChange(null)} /> : <TextInput.Icon icon="calendar" />
            }
            editable={false}
          />
        </View>
      </Pressable>
      {value && clearable ? (
        <Button compact style={{ alignSelf: 'flex-end', marginTop: -4 }} onPress={() => onChange(null)}>
          Clear {label.toLowerCase()}
        </Button>
      ) : null}
      {Platform.OS === 'ios' ? (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop }}>
            <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 12, paddingBottom: 32 }}>
              <DateTimePicker
                value={draft}
                mode="date"
                display="inline"
                themeVariant={dark ? 'dark' : 'light'}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onValueChange={(_, d) => setDraft(d)}
                accentColor={colors.primary}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                <Button onPress={() => setIosOpen(false)}>Cancel</Button>
                <Button
                  mode="contained"
                  onPress={() => {
                    onChange(toDayString(draft));
                    setIosOpen(false);
                  }}
                >
                  Done
                </Button>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}
