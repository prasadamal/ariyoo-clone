import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, IconButton, Menu, Portal, Text, TextInput } from 'react-native-paper';
import { MOODS } from '../../components/MoodChips';
import { parseAmount, formatMoney } from '../../lib/momentMoney';
import { useAppTheme } from '../../theme';
import { ChipSelect } from '../../ui/ChipSelect';
import { Icon } from '../../ui/Icon';
import { EXPENSE_CATEGORIES } from './BudgetTab';
import type { PickedPhoto } from './photoPicker';

export type MomentMoney = { amount: number; category: string };

type Props = {
  placeholder: string;
  text: string;
  onText: (t: string) => void;
  mood: string;
  onMood: (m: string) => void;
  photos: PickedPhoto[];
  onPhotos: (p: PickedPhoto[]) => void;
  onAddPhotos: () => void;
  location: boolean;
  onLocation: (on: boolean) => void;
  money: MomentMoney | null;
  onMoney: (m: MomentMoney | null) => void;
  currencySymbol: string;
  recording: boolean;
  voiceBusy: boolean;
  onToggleVoice: () => void;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
};

/**
 * The moment box. Whatever is added (photos, mood, location, money, a recording) shows as small chips
 * and thumbnails above the text, like attachments in a chat box. The icons below add them.
 */
export function MomentComposer(p: Props) {
  const { colors } = useAppTheme();
  const [moodOpen, setMoodOpen] = useState(false);
  const [moneyOpen, setMoneyOpen] = useState(false);
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState('food');
  const amount = parseAmount(amountText);
  const hasTray = p.photos.length > 0 || Boolean(p.mood) || p.location || Boolean(p.money) || p.recording;

  const openMoney = () => {
    setAmountText(p.money ? String(p.money.amount) : '');
    setCategory(p.money?.category ?? 'food');
    setMoneyOpen(true);
  };
  const categoryLabel = (value: string) => EXPENSE_CATEGORIES.find(c => c.value === value)?.label ?? value;

  const tool = (icon: string, label: string, onPress: () => void, active = false, disabled = false) => (
    <IconButton
      icon={icon}
      size={22}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      iconColor={active ? colors.primary : colors.onSurfaceVariant}
      style={{ margin: 0, backgroundColor: active ? colors.primaryContainer : 'transparent' }}
    />
  );

  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {hasTray ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tray} keyboardShouldPersistTaps="handled">
          {p.photos.map((photo, i) => (
            <View key={photo.uri + i}>
              <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" accessibilityLabel={`Photo ${i + 1}`} />
              <Pressable
                onPress={() => p.onPhotos(p.photos.filter((_, j) => j !== i))}
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${i + 1}`}
                style={[styles.remove, { backgroundColor: colors.inverseSurface }]}
              >
                <Icon name="close" size={12} color={colors.inverseOnSurface} />
              </Pressable>
            </View>
          ))}
          {p.mood ? (
            <Chip onClose={() => p.onMood('')} closeIconAccessibilityLabel="Remove mood" compact>
              {p.mood}
            </Chip>
          ) : null}
          {p.location ? (
            <Chip icon="map-marker" onClose={() => p.onLocation(false)} closeIconAccessibilityLabel="Remove location" compact>
              Location
            </Chip>
          ) : null}
          {p.money ? (
            <Chip icon="currency-inr" onPress={openMoney} onClose={() => p.onMoney(null)} closeIconAccessibilityLabel="Remove money" compact>
              {formatMoney(p.money.amount, p.currencySymbol)} · {categoryLabel(p.money.category)}
            </Chip>
          ) : null}
          {p.recording ? (
            <Chip icon="record-circle" onPress={p.onToggleVoice} compact textStyle={{ color: colors.danger, fontWeight: '700' }}>
              Recording… tap to stop
            </Chip>
          ) : null}
        </ScrollView>
      ) : null}

      <TextInput
        mode="flat"
        placeholder={p.placeholder}
        value={p.text}
        onChangeText={p.onText}
        multiline
        style={styles.input}
        underlineColor="transparent"
        activeUnderlineColor="transparent"
      />

      <View style={styles.tools}>
        <Menu
          visible={moodOpen}
          onDismiss={() => setMoodOpen(false)}
          anchor={tool('emoticon-happy-outline', 'Add a mood', () => setMoodOpen(true), Boolean(p.mood), p.recording)}
        >
          {MOODS.map(m => (
            <Menu.Item
              key={m}
              title={m}
              onPress={() => {
                p.onMood(m === p.mood ? '' : m);
                setMoodOpen(false);
              }}
            />
          ))}
        </Menu>
        {tool('camera-outline', 'Add photos', p.onAddPhotos, p.photos.length > 0, p.recording)}
        {tool(p.recording ? 'stop-circle' : 'microphone-outline', p.recording ? 'Stop and save voice note' : 'Record a voice note', p.onToggleVoice, p.recording, p.voiceBusy)}
        {tool(p.location ? 'map-marker' : 'map-marker-outline', p.location ? 'Remove location' : 'Add location and weather', () => p.onLocation(!p.location), p.location, p.recording)}
        {tool('currency-inr', 'Add money spent', openMoney, Boolean(p.money), p.recording)}
        <View style={{ flex: 1 }} />
        <Button mode="contained" icon="send" onPress={p.onSave} loading={p.saving} disabled={!p.canSave || p.saving || p.recording} compact style={{ borderRadius: 999 }}>
          Save
        </Button>
      </View>

      <Portal>
        <Dialog visible={moneyOpen} onDismiss={() => setMoneyOpen(false)}>
          <Dialog.Title>Money spent here</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Amount"
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
              left={<TextInput.Affix text={p.currencySymbol} />}
              autoFocus
              error={amountText.length > 0 && amount === null}
            />
            <View style={{ height: 12 }} />
            <ChipSelect scroll options={EXPENSE_CATEGORIES} value={category} onChange={setCategory} />
            <Text style={{ color: colors.muted, marginTop: 8, fontSize: 12 }}>It is added to this journey's budget and total.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setMoneyOpen(false)}>Cancel</Button>
            <Button
              mode="contained"
              disabled={amount === null}
              onPress={() => {
                if (amount !== null) p.onMoney({ amount, category });
                setMoneyOpen(false);
              }}
            >
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 20, borderWidth: 1, padding: 8, marginBottom: 16 },
  tray: { gap: 8, alignItems: 'center', paddingHorizontal: 6, paddingTop: 6, paddingBottom: 8 },
  thumb: { width: 60, height: 60, borderRadius: 12 },
  remove: { position: 'absolute', top: -5, right: -5, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  input: { backgroundColor: 'transparent', minHeight: 64, maxHeight: 180 },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingTop: 2 },
});
