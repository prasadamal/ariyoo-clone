import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput as NativeInput,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { ActivityIndicator, Button, Dialog, IconButton, Menu, Portal, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MomentPhotos } from '../../src/components/MomentPhotos';
import { useSync } from '../../src/context/SyncContext';
import { useToast } from '../../src/context/ToastContext';
import { DIARY_LINE_HEIGHT, DIARY_THEMES, diaryTheme, type DiaryTheme, type DiaryThemeId } from '../../src/features/diary/diaryThemes';
import { dayOf, diaryPages, pageIndexFor, type DiaryPage } from '../../src/features/diary/diaryPages';
import { pickPhotos } from '../../src/features/trip/photoPicker';
import { ensureEverydayTrip } from '../../src/lib/everyday';
import { formatDay } from '../../src/lib/format';
import { uuid } from '../../src/lib/id';
import { deleteEntry, listEntries, listEntryMedia, updateTrip, upsertEntry, upsertEntryMedia, type LocalEntry, type LocalTrip } from '../../src/lib/localDb';
import { persistJournalPhoto } from '../../src/lib/media';
import { capitalizeWords } from '../../src/lib/names';
import { useAppTheme } from '../../src/theme';
import { TAB_BAR_SPACE } from '../../src/ui/GlassTabBar';
import { Icon } from '../../src/ui/Icon';

const THEME_KEY = 'wayfare_diary_theme_v1';
const SAVE_DELAY_MS = 700;

const longDate = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Faint ruled lines behind the writing, like a paper diary (themes without lines skip this). */
function Rules({ theme, height }: { theme: DiaryTheme; height: number }) {
  if (!theme.rule && !theme.margin) return null;
  const count = Math.ceil(height / DIARY_LINE_HEIGHT) + 2;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height }}>
      {theme.rule
        ? Array.from({ length: count }, (_, i) => (
            <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: 8 + (i + 1) * DIARY_LINE_HEIGHT, height: 1, backgroundColor: theme.rule! }} />
          ))
        : null}
      {theme.margin ? <View style={{ position: 'absolute', top: 0, bottom: 0, left: 34, width: 1.5, backgroundColor: theme.margin }} /> : null}
    </View>
  );
}

/**
 * The diary: today's page is one big writing space that saves as you type. Swipe left for earlier
 * days (read only: the past stays as you wrote it); there are no future pages. The calendar jumps
 * to any date; the palette changes the paper.
 */
export default function DiaryScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const toast = useToast();
  const { refreshPending } = useSync();
  const [trip, setTrip] = useState<LocalTrip | null>(null);
  const [failed, setFailed] = useState(false);
  const [entries, setEntries] = useState<LocalEntry[]>([]);
  const [today, setToday] = useState(dayOf(new Date()));
  const [themeId, setThemeId] = useState<DiaryThemeId>('diary');
  const [themeMenu, setThemeMenu] = useState(false);
  const [page, setPage] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mediaKey, setMediaKey] = useState(0);
  // Height of the swipe area: each page fills it down to the tab bar.
  const [pageHeight, setPageHeight] = useState(0);
  const list = useRef<FlatList<DiaryPage<LocalEntry>>>(null);
  const theme = diaryTheme(themeId);

  // Today's writing, saved shortly after you stop typing (and when you leave the page).
  const [text, setText] = useState('');
  const todayEntry = useRef<LocalEntry | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  const open = useCallback(async () => {
    setFailed(false);
    try {
      const t = await ensureEverydayTrip();
      setTrip(t);
      setName(t.title);
      const all = await listEntries(t.id);
      const now = dayOf(new Date());
      setToday(now);
      setEntries(all);
      // Today's page is the first moment written today (yours).
      const mine = all.filter(e => !e.author_id && dayOf(e.recorded_at) === now);
      if (!dirty.current) {
        todayEntry.current = mine[0] ?? null;
        setText(mine[0]?.body && mine[0].body !== '📷' ? mine[0].body : '');
      }
    } catch {
      setFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      open();
    }, [open])
  );

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then(v => v && setThemeId(diaryTheme(v).id))
      .catch(() => undefined);
  }, []);

  const save = useCallback(
    async (body: string) => {
      if (!trip) return;
      dirty.current = false;
      const now = new Date().toISOString();
      const current = todayEntry.current;
      if (current) {
        const hasPhotos = (await listEntryMedia(current.id)).length > 0;
        if (!body.trim() && !hasPhotos) {
          await deleteEntry(current.id);
          todayEntry.current = null;
        } else {
          const next = { ...current, body, sync_status: 'pending', updated_at: now };
          await upsertEntry(next);
          todayEntry.current = next;
        }
      } else if (body.trim()) {
        const created: LocalEntry = {
          id: uuid(),
          trip_id: trip.id,
          recorded_at: now,
          body,
          mood: null,
          place_name: null,
          weather: null,
          latitude: null,
          longitude: null,
          altitude_m: null,
          sync_status: 'pending',
          updated_at: now,
        };
        await upsertEntry(created);
        todayEntry.current = created;
      }
      refreshPending();
    },
    [trip, refreshPending]
  );

  const onText = (t: string) => {
    setText(t);
    dirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(t), SAVE_DELAY_MS);
  };

  // Never lose the last words: save when leaving the screen.
  const latest = useRef(text);
  latest.current = text;
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (dirty.current) void save(latest.current);
    },
    [save]
  );

  const addPhoto = async () => {
    if (!trip) return;
    try {
      const picked = await pickPhotos(true);
      if (!picked.length) return;
      // A photo needs today's page to exist.
      if (!todayEntry.current) {
        const now = new Date().toISOString();
        const created: LocalEntry = { id: uuid(), trip_id: trip.id, recorded_at: now, body: text || '📷', mood: null, place_name: null, weather: null, latitude: null, longitude: null, altitude_m: null, sync_status: 'pending', updated_at: now };
        await upsertEntry(created);
        todayEntry.current = created;
      }
      for (const p of picked) {
        const mediaId = uuid();
        const stored = await persistJournalPhoto(p.uri, mediaId, p);
        await upsertEntryMedia({ id: mediaId, trip_id: trip.id, entry_id: todayEntry.current.id, local_uri: stored.uri, storage_path: null, mime_type: stored.mimeType, sync_status: 'pending', updated_at: new Date().toISOString() });
      }
      setMediaKey(k => k + 1);
      refreshPending();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add the photo');
    }
  };

  const pages = useMemo(() => diaryPages(entries, today), [entries, today]);

  const goTo = (day: string) => {
    const { index, exact } = pageIndexFor(pages, day);
    list.current?.scrollToIndex({ index, animated: true });
    setPage(index);
    if (!exact) toast(`Nothing written on ${formatDay(day)} — showing ${index === 0 ? 'today' : formatDay(pages[index].day)}`);
  };

  const openPicker = () => {
    const current = new Date(`${pages[page]?.day ?? today}T12:00:00`);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        maximumDate: new Date(),
        onChange: (e, d) => {
          if (e.type === 'set' && d) goTo(dayOf(d));
        },
      });
    } else setPickerOpen(true);
  };

  const chooseTheme = (id: DiaryThemeId) => {
    setThemeId(id);
    setThemeMenu(false);
    AsyncStorage.setItem(THEME_KEY, id).catch(() => undefined);
  };

  const saveName = async () => {
    setEditingName(false);
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!trip || !clean || clean === trip.title) {
      setName(trip?.title ?? '');
      return;
    }
    const next = await updateTrip(trip.id, { title: clean });
    if (next) setTrip(next);
    refreshPending();
  };

  if (failed) {
    return (
      <View style={{ flex: 1, padding: 24, paddingTop: insets.top + 40, backgroundColor: colors.background }}>
        <Text variant="titleMedium">Your diary could not be opened.</Text>
        <Text style={{ color: colors.muted, marginTop: 6 }}>Nothing was lost. Please try again.</Text>
        <Button mode="contained" onPress={open} style={{ marginTop: 16, alignSelf: 'flex-start' }}>
          Try again
        </Button>
      </View>
    );
  }
  if (!trip) return <ActivityIndicator style={{ marginTop: insets.top + 60 }} accessibilityLabel="Opening your diary" />;

  const onSwipe = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    if (index !== page) setPage(index);
  };

  const renderPage = ({ item, index }: { item: DiaryPage<LocalEntry>; index: number }) => {
    const isToday = index === 0;
    return (
      <View style={{ width, height: pageHeight || undefined, paddingHorizontal: 16, paddingBottom: TAB_BAR_SPACE - 8 }}>
        <View style={{ flex: 1, borderRadius: 22, backgroundColor: theme.paper, overflow: 'hidden', borderWidth: theme.dark ? 0 : 1, borderColor: '#00000010' }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingLeft: theme.margin ? 46 : 20, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, color: theme.faint, fontFamily: theme.font, fontSize: 14, fontStyle: 'italic' }}>{longDate(item.day)}</Text>
            {isToday ? (
              <IconButton icon="image-plus" size={20} iconColor={theme.faint} onPress={addPhoto} accessibilityLabel="Add a photo to today's page" style={{ margin: 0 }} />
            ) : (
              <Icon name="lock-outline" size={16} color={theme.faint} />
            )}
          </View>
          {isToday ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
              <View style={{ flex: 1, minHeight: 400 }}>
                <Rules theme={theme} height={2400} />
                <NativeInput
                  value={text}
                  onChangeText={onText}
                  multiline
                  placeholder="Dear diary…"
                  placeholderTextColor={theme.faint}
                  textAlignVertical="top"
                  accessibilityLabel="Today's diary page"
                  style={{
                    flex: 1,
                    minHeight: 400,
                    color: theme.ink,
                    fontFamily: theme.font,
                    fontSize: 18,
                    lineHeight: DIARY_LINE_HEIGHT,
                    paddingTop: 10,
                    paddingBottom: 24,
                    paddingLeft: theme.margin ? 46 : 20,
                    paddingRight: 20,
                    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
                  }}
                />
              </View>
              {todayEntry.current ? (
                <View style={{ paddingBottom: 16 }}>
                  <MomentPhotos entryId={todayEntry.current.id} refreshKey={mediaKey} onChanged={() => setMediaKey(k => k + 1)} />
                </View>
              ) : null}
            </ScrollView>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
              <View>
                <Rules theme={theme} height={Math.max(800, item.entries.length * 400)} />
                {item.entries.map((e, i) => (
                  <View key={e.id}>
                    {item.entries.length > 1 ? (
                      <Text style={{ color: theme.faint, fontFamily: theme.font, fontSize: 13, paddingLeft: theme.margin ? 46 : 20, marginTop: i ? 12 : 6 }}>
                        {new Date(e.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    ) : null}
                    {e.body && e.body !== '📷' && e.body !== '🎙 Voice note' ? (
                      <Text style={{ color: theme.ink, fontFamily: theme.font, fontSize: 18, lineHeight: DIARY_LINE_HEIGHT, paddingTop: 10, paddingLeft: theme.margin ? 46 : 20, paddingRight: 20 }}>
                        {e.body}
                      </Text>
                    ) : null}
                    <MomentPhotos entryId={e.id} canEdit={false} />
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior="padding">
      {/* The diary's own name (tap to rename), the page you're on, the date jump and the paper. */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          {editingName ? (
            <TextInput
              dense
              mode="outlined"
              value={name}
              onChangeText={t => setName(capitalizeWords(t))}
              onBlur={saveName}
              onSubmitEditing={saveName}
              autoFocus
              maxLength={40}
              returnKeyType="done"
            />
          ) : (
            <Pressable onPress={() => setEditingName(true)} accessibilityRole="button" accessibilityLabel={`${trip.title}. Tap to rename your diary`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text variant="headlineSmall" style={{ fontWeight: '800', flexShrink: 1 }} numberOfLines={1}>
                {trip.title === 'Everyday journal' ? 'My diary' : trip.title}
              </Text>
              <Icon name="pencil-outline" size={16} color={colors.muted} />
            </Pressable>
          )}
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
            {page === 0 ? (pages.length > 1 ? 'Today · swipe left for earlier days' : 'Today') : `${formatDay(pages[page]?.day ?? today)} · read only`}
          </Text>
        </View>
        {page !== 0 ? (
          <IconButton icon="calendar-today" onPress={() => goTo(today)} accessibilityLabel="Back to today" />
        ) : null}
        <IconButton icon="calendar-search" onPress={openPicker} accessibilityLabel="Go to a date" />
        <Menu
          visible={themeMenu}
          onDismiss={() => setThemeMenu(false)}
          anchor={<IconButton icon="palette-outline" onPress={() => setThemeMenu(true)} accessibilityLabel="Diary style" />}
        >
          {DIARY_THEMES.map(t => (
            <Menu.Item key={t.id} title={t.name} leadingIcon={t.id === themeId ? 'check' : undefined} onPress={() => chooseTheme(t.id)} />
          ))}
        </Menu>
      </View>

      <View style={{ flex: 1 }} onLayout={e => setPageHeight(e.nativeEvent.layout.height)}>
      <FlatList
        ref={list}
        data={pages}
        keyExtractor={p => p.day}
        renderItem={renderPage}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onSwipe}
        onScroll={Platform.OS === 'web' ? onSwipe : undefined}
        scrollEventThrottle={64}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      />
      </View>

      {/* iPhone and web: a date picker sheet (Android uses its own pop-up calendar). */}
      {Platform.OS === 'ios' ? (
        <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: '#0006', justifyContent: 'flex-end' }} onPress={() => setPickerOpen(false)}>
            <View style={{ backgroundColor: colors.surface, padding: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
              <DateTimePicker
                value={new Date(`${pages[page]?.day ?? today}T12:00:00`)}
                mode="date"
                display="inline"
                maximumDate={new Date()}
                onChange={(_, d) => {
                  if (d) {
                    setPickerOpen(false);
                    goTo(dayOf(d));
                  }
                }}
              />
            </View>
          </Pressable>
        </Modal>
      ) : (
        <Portal>
          <Dialog visible={pickerOpen} onDismiss={() => setPickerOpen(false)}>
            <Dialog.Title>Go to a day</Dialog.Title>
            <Dialog.ScrollArea style={{ maxHeight: 360 }}>
              <ScrollView>
                {pages.map((p, i) => (
                  <Button key={p.day} onPress={() => { setPickerOpen(false); goTo(p.day); }} style={{ alignItems: 'flex-start' }}>
                    {i === 0 ? 'Today' : longDate(p.day)}
                  </Button>
                ))}
              </ScrollView>
            </Dialog.ScrollArea>
          </Dialog>
        </Portal>
      )}
    </KeyboardAvoidingView>
  );
}
