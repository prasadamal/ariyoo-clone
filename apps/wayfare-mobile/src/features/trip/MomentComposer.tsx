import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, IconButton, Menu, Text, TextInput } from 'react-native-paper';
import { MOODS } from '../../components/MoodChips';
import { amountProblem, parseAmount, formatMoney } from '../../lib/momentMoney';
import { typingMention } from '../../lib/mentions';
import { useAppTheme } from '../../theme';
import { ChipSelect } from '../../ui/ChipSelect';
import { Icon } from '../../ui/Icon';
import { PlaceField } from '../../ui/PlaceField';
import { Sheet, SheetTextInput } from '../../ui/Sheet';
import type { Destination } from '../../content/destinations';
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
  money: MomentMoney | null;
  onMoney: (m: MomentMoney | null) => void;
  /** A place typed or picked from the list (no GPS): it adds the moment to "Places visited". */
  place?: { name: string | null; region: string | null; countryCode: string | null } | null;
  onPlace?: (p: { name: string | null; region: string | null; countryCode: string | null } | null) => void;
  currencySymbol: string;
  recording: boolean;
  /** Voice notes recorded for this moment, waiting for Save. */
  voiceCount?: number;
  onRemoveVoice?: (index: number) => void;
  voiceBusy: boolean;
  /** This moment holds as many voice notes as it can (the microphone rests). */
  voiceFull?: boolean;
  onToggleVoice: () => void;
  /** The phone is handing over photos you picked: a spinner tile shows in the tray. */
  addingPhotos?: boolean;
  /** While saving: how many photos are stored so far (the rest show a spinner). Null when not saving. */
  savedPhotos?: number | null;
  /** The moment's time, taken from its earliest photo (tap × to use now instead). */
  photoTime?: string | null;
  onClearPhotoTime?: () => void;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  /** Usernames of the crew, offered while typing an @mention. */
  mentionable?: string[];
};


/**
 * The moment box. Whatever is added (photos, money, a recording) shows as small chips
 * and thumbnails above the text, like attachments in a chat box. The icons below add them.
 */
/** An attachment in the moment box: icon, words, and a remove button centred on the right. */
function TrayPill({ icon, label, onPress, onRemove, removeLabel, danger }: { icon?: string; label: string; onPress?: () => void; onRemove?: () => void; removeLabel?: string; danger?: boolean }) {
  const { colors } = useAppTheme();
  const fg = danger ? colors.danger : colors.onSurfaceVariant;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 34, borderRadius: 17, paddingLeft: 12, paddingRight: onRemove ? 4 : 12, gap: 6, backgroundColor: colors.surfaceVariant }}>
      <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityRole={onPress ? 'button' : undefined}>
        {icon ? <Icon name={icon} size={16} color={fg} /> : null}
        <Text style={{ color: fg, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>{label}</Text>
      </Pressable>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel={removeLabel ?? 'Remove'} style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={15} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** "Thu 12 Mar, 9:14 am": when the photo was taken. */
function photoTimeLabel(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${time}`;
}

/** The longest moment text (about two pages): plenty for a day, and quick to sync. */
export const MAX_MOMENT_TEXT = 5000;

export function MomentComposer(p: Props) {
  const { colors } = useAppTheme();
  // Thumbnails that have finished drawing (big photos take a moment): the others show a ring.
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [moodOpen, setMoodOpen] = useState(false);
  const [moneyOpen, setMoneyOpen] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeText, setPlaceText] = useState('');
  const [placeMatch, setPlaceMatch] = useState<Destination | undefined>(undefined);
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState('food');
  const amount = parseAmount(amountText);
  const voiceCount = p.voiceCount ?? 0;
  // The place isn't a chip: the pin below turns purple once one is added (tap it to change or clear).
  const hasTray = p.photos.length > 0 || Boolean(p.money) || p.recording || voiceCount > 0 || Boolean(p.addingPhotos) || Boolean(p.photoTime);
  // A fixed height keeps the sideways tray from stretching on Android (chips grew and touched the border).
  const trayHeight = (p.photos.length || p.addingPhotos ? 60 : 34) + 14;
  // The chosen mood's emoji replaces the smiley button itself (no extra chip).
  const moodEmoji = p.mood ? p.mood.split(' ')[0] : '';

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
        <View style={{ height: trayHeight }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.tray} keyboardShouldPersistTaps="handled">
          {p.photos.map((photo, i) => {
            // A ring while the thumbnail draws, and while saving until this photo is stored.
            const busy = !loaded[photo.uri] || (p.savedPhotos != null && i >= p.savedPhotos);
            return (
              <View key={photo.uri + i}>
                <Image
                  source={{ uri: photo.uri }}
                  style={[styles.thumb, { backgroundColor: colors.surfaceVariant }]}
                  contentFit="cover"
                  accessibilityLabel={`Photo ${i + 1}${busy ? ', loading' : ''}`}
                  onLoad={() => setLoaded(prev => (prev[photo.uri] ? prev : { ...prev, [photo.uri]: true }))}
                  onError={() => setLoaded(prev => ({ ...prev, [photo.uri]: true }))}
                />
                {busy ? (
                  <View style={[styles.thumb, styles.busy]} pointerEvents="none">
                    <ActivityIndicator color="#fff" />
                  </View>
                ) : null}
                {p.savedPhotos == null ? (
                  <Pressable
                    onPress={() => p.onPhotos(p.photos.filter((_, j) => j !== i))}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove photo ${i + 1}`}
                    style={[styles.remove, { backgroundColor: colors.inverseSurface }]}
                  >
                    <Icon name="close" size={12} color={colors.inverseOnSurface} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
          {p.addingPhotos ? (
            <View style={[styles.thumb, { backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' }]} accessibilityLabel="Adding photos" accessibilityRole="progressbar">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}
          {p.photoTime ? (
            <TrayPill
              icon="clock-outline"
              label={`${photoTimeLabel(p.photoTime)} · photo time`}
              onRemove={p.onClearPhotoTime}
              removeLabel="Use the time now instead of the photo's time"
            />
          ) : null}
          {p.money ? (
            <TrayPill
              icon="currency-inr"
              label={`${formatMoney(p.money.amount, p.currencySymbol)} · ${categoryLabel(p.money.category)}`}
              onPress={openMoney}
              onRemove={() => p.onMoney(null)}
              removeLabel="Remove money"
            />
          ) : null}
          {Array.from({ length: voiceCount }, (_, i) => (
            <TrayPill key={`voice-${i}`} icon="microphone" label={voiceCount > 1 ? `Voice note ${i + 1}` : 'Voice note'} onRemove={() => p.onRemoveVoice?.(i)} removeLabel="Remove voice note" />
          ))}
          {/* Recording: tap anywhere on the pill to stop. */}
          {p.recording ? <TrayPill icon="record-circle" label="Recording · tap to stop" onPress={p.voiceBusy ? undefined : p.onToggleVoice} danger /> : null}
        </ScrollView>
        </View>
      ) : null}

      <TextInput
        mode="flat"
        placeholder={p.placeholder}
        value={p.text}
        onChangeText={p.onText}
        multiline
        maxLength={MAX_MOMENT_TEXT}
        style={styles.input}
        underlineColor="transparent"
        activeUnderlineColor="transparent"
      />
      {(() => {
        // Typing "@" in a shared journey offers the crew's usernames.
        const typed = typingMention(p.text);
        const options = typed == null ? [] : (p.mentionable ?? []).filter(u => u.startsWith(typed) && u !== typed).slice(0, 6);
        if (!options.length || typed == null) return null;
        return (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingHorizontal: 10, paddingBottom: 6 }}>
            {options.map(u => (
              <Chip key={u} compact icon="at" onPress={() => p.onText(p.text.slice(0, p.text.length - typed.length) + u + ' ')}>
                {u}
              </Chip>
            ))}
          </ScrollView>
        );
      })()}

      <View style={styles.tools}>
        <Menu
          visible={moodOpen}
          onDismiss={() => setMoodOpen(false)}
          anchor={
            moodEmoji ? (
              <Pressable
                onPress={() => setMoodOpen(true)}
                disabled={p.recording}
                accessibilityRole="button"
                accessibilityLabel={`Mood: ${p.mood}. Tap to change`}
                style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryContainer }}
              >
                <Text style={{ fontSize: 22 }}>{moodEmoji}</Text>
              </Pressable>
            ) : (
              tool('emoticon-happy-outline', 'Add a mood', () => setMoodOpen(true), false, p.recording)
            )
          }
        >
          {p.mood ? <Menu.Item key="none" title="No mood" leadingIcon="close" onPress={() => { p.onMood(''); setMoodOpen(false); }} /> : null}
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
        {/* Photos and money show in the tray above, so their buttons stay plain. */}
        {tool('camera-outline', 'Add photos', p.onAddPhotos, false, p.recording || Boolean(p.addingPhotos) || p.savedPhotos != null)}
        {tool(
          p.recording ? 'stop-circle' : 'microphone-outline',
          p.recording ? 'Stop recording' : p.voiceFull ? 'This moment holds all the voice notes it can' : 'Record a voice note',
          p.onToggleVoice,
          p.recording,
          p.voiceBusy || (!p.recording && Boolean(p.voiceFull))
        )}
        {p.onPlace
          ? tool(p.place ? 'map-marker' : 'map-marker-outline', p.place ? `Place: ${p.place.name ?? 'added'}. Tap to change` : 'Add a place', () => { setPlaceText(p.place?.name ?? ''); setPlaceOpen(true); }, Boolean(p.place), p.recording)
          : null}
        {tool('currency-inr', p.money ? 'Change money spent' : 'Add money spent', openMoney, false, p.recording)}
        <View style={{ flex: 1 }} />
        <IconButton
          icon="send"
          mode="contained"
          size={22}
          containerColor={colors.primary}
          iconColor={colors.onPrimary}
          onPress={p.onSave}
          loading={p.saving}
          disabled={!p.canSave || p.saving || p.recording || Boolean(p.addingPhotos)}
          accessibilityLabel="Save moment"
          style={{ margin: 0 }}
        />
      </View>

      {/* Place and money slide up from the bottom; typing lifts them above the keyboard. */}
      <Sheet visible={placeOpen} onDismiss={() => setPlaceOpen(false)} title="Where was this?" subtitle="Pick from the list to add it to Places visited. No GPS is used.">
        <PlaceField
          label="Place"
          inSheet
          value={placeText}
          onChange={(t, d) => {
            setPlaceText(t);
            setPlaceMatch(d);
          }}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          {p.place ? (
            <Button
              textColor={colors.danger}
              onPress={() => {
                p.onPlace?.(null);
                setPlaceOpen(false);
              }}
            >
              Remove place
            </Button>
          ) : null}
          <View style={{ flex: 1 }} />
          <Button
            mode="contained"
            disabled={!placeText.trim()}
            contentStyle={{ paddingHorizontal: 12 }}
            onPress={() => {
              p.onPlace?.({ name: placeText.trim(), region: placeMatch?.region ?? null, countryCode: placeMatch?.countryCode ?? null });
              setPlaceOpen(false);
            }}
          >
            Add place
          </Button>
        </View>
      </Sheet>
      <Sheet visible={moneyOpen} onDismiss={() => setMoneyOpen(false)} title="Money spent here" subtitle="It is added to this journey's budget and total.">
        <SheetTextInput
          mode="outlined"
          label="Amount"
          value={amountText}
          onChangeText={t => setAmountText(t.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          left={<TextInput.Affix text={p.currencySymbol} />}
          autoFocus
          maxLength={14}
          error={amountText.length > 0 && amount === null}
        />
        {amountProblem(amountText) ? <Text style={{ color: colors.error, fontSize: 12, marginTop: 6 }}>{amountProblem(amountText)}</Text> : null}
        <View style={{ height: 12 }} />
        <ChipSelect scroll options={EXPENSE_CATEGORIES} value={category} onChange={setCategory} />
        <Button
          mode="contained"
          disabled={amount === null}
          style={{ marginTop: 16 }}
          contentStyle={{ height: 48 }}
          onPress={() => {
            if (amount !== null) p.onMoney({ amount, category });
            setMoneyOpen(false);
          }}
        >
          Add to moment
        </Button>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 20, borderWidth: 1, padding: 8, marginBottom: 16 },
  tray: { gap: 8, alignItems: 'center', paddingHorizontal: 6, paddingTop: 6, paddingBottom: 8, flexGrow: 0 },
  thumb: { width: 60, height: 60, borderRadius: 12 },
  busy: { position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  remove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  input: { backgroundColor: 'transparent', minHeight: 64, maxHeight: 180 },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingTop: 2 },
});
