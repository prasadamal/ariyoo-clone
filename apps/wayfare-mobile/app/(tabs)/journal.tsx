import AsyncStorage from '@react-native-async-storage/async-storage';
import { track } from '../../src/lib/telemetry';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  PanResponder,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput as NativeInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { ActivityIndicator, Button, Dialog, IconButton, Portal, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MomentPhotos } from '../../src/components/MomentPhotos';
import { useSync } from '../../src/context/SyncContext';
import { useToast } from '../../src/context/ToastContext';
import { DIARY_LINE_HEIGHT, DIARY_THEMES, diaryTheme, type DiaryTheme, type DiaryThemeId } from '../../src/features/diary/diaryThemes';
import { dayOf, diarySheets, linesToTap, pageIndexFor, swipeOutcome, todayPageKey, type DiarySheet } from '../../src/features/diary/diaryPages';
import { pickPhotos } from '../../src/features/trip/photoPicker';
import { MoodCalendar } from '../../src/features/diary/MoodCalendar';
import { writingStreak } from '../../src/features/diary/moodCalendarRules';
import { ensureEverydayTrip } from '../../src/lib/everyday';
import { formatDay } from '../../src/lib/format';
import { uuid } from '../../src/lib/id';
import { deleteEntry, listAllEntries, listEntries, listEntryMedia, updateTrip, upsertEntry, upsertEntryMedia, type LocalEntry, type LocalTrip } from '../../src/lib/localDb';
import { persistJournalPhoto } from '../../src/lib/media';
import { capitalizeWords } from '../../src/lib/names';
import { parseRich, RICH_COLORS, toggleLine, toggleWrap, type RichColor, type RichLine, type Selection } from '../../src/lib/richText';
import { useAppTheme } from '../../src/theme';
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

/** Formatted diary text. In the editor the marks stay (faint and tiny) so typing never loses them. */
function RichText({ lines, theme, editing }: { lines: RichLine[]; theme: DiaryTheme; editing: boolean }) {
  return (
    <>
      {lines.map((line, li) => {
        const size = line.kind === 'h1' ? 26 : line.kind === 'h2' ? 21 : 18;
        const weight = line.kind === 'p' ? undefined : ('800' as const);
        return (
          <Text key={li} style={{ fontSize: size, fontWeight: weight }}>
            {li ? '\n' : ''}
            {editing && line.prefix ? <Text style={{ fontSize: 10, color: theme.faint }}>{line.prefix}</Text> : null}
            {line.spans.map((sp, si) =>
              sp.marker ? (
                editing ? (
                  <Text key={si} style={{ fontSize: 9, color: theme.faint }}>
                    {sp.text}
                  </Text>
                ) : null
              ) : (
                <Text
                  key={si}
                  style={{
                    fontWeight: sp.bold || weight ? '800' : undefined,
                    textDecorationLine: sp.underline ? 'underline' : 'none',
                    color: sp.color ? RICH_COLORS[sp.color] : theme.ink,
                  }}
                >
                  {sp.text}
                </Text>
              )
            )}
          </Text>
        );
      })}
    </>
  );
}

/** A gentle question on a blank page, different each day. */
const PROMPTS = [
  'Dear diary…',
  'What made today different?',
  'One thing you want to remember from today…',
  'Who did you meet today?',
  'What surprised you today?',
  'Where did your mind wander today?',
  'A small thing that made you smile…',
];
const promptFor = (day: string, page: number) => PROMPTS[(Number(day.replace(/-/g, '')) + page) % PROMPTS.length];
const wordCount = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const isBlankBody = (b: string | null | undefined) => !b || b === '📷';

/**
 * The diary: one page per day. Today's page saves as you type; swipe right for earlier days (read
 * only: the past stays as you wrote it) and left to come back to today; there are no future pages.
 * The calendar jumps to any date; the palette switches to the next paper (lavender by default).
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
  const [themeId, setThemeId] = useState<DiaryThemeId>('lavender');
  const [formatOpen, setFormatOpen] = useState(false);
  // Which day is open: 0 is today, then earlier written days.
  const [page, setPage] = useState(0);
  const pageRef = useRef(0);
  pageRef.current = page;
  const slide = useRef(new Animated.Value(0)).current;
  // Height of the writing so far, so a tap on an empty line below it can move the pen there.
  const contentHeight = useRef(0);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mediaKey, setMediaKey] = useState(0);
  const theme = diaryTheme(themeId);

  // Today's page (one per day), what's typed on it, and the entry it writes to.
  const [todayKeys, setTodayKeys] = useState<string[]>(['new-0']);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const entryByKey = useRef<Record<string, LocalEntry | null>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const dirty = useRef(new Set<string>());
  const latestDrafts = useRef(drafts);
  latestDrafts.current = drafts;
  // Formatting: the selection on the page being edited; a bump re-reads the text after a toolbar edit.
  const selection = useRef<Selection>({ start: 0, end: 0 });
  const [editorKey, setEditorKey] = useState(0);
  const [forcedSelection, setForcedSelection] = useState<Selection | undefined>(undefined);

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
      if (!dirty.current.size) {
        const mine = all.filter(e => !e.author_id);
        const keys = [todayPageKey(mine, now)];
        const byId = new Map(mine.map(e => [e.id, e]));
        entryByKey.current = Object.fromEntries(keys.map(k => [k, byId.get(k) ?? null]));
        setTodayKeys(keys);
        setDrafts(Object.fromEntries(keys.map(k => [k, isBlankBody(byId.get(k)?.body) ? '' : byId.get(k)!.body ?? ''])));
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

  /** Writes one of today's pages: creates its entry on the first words, removes it when emptied. */
  const save = useCallback(
    async (key: string, body: string) => {
      if (!trip) return;
      dirty.current.delete(key);
      const now = new Date().toISOString();
      const current = entryByKey.current[key] ?? null;
      if (current) {
        const hasPhotos = (await listEntryMedia(current.id)).length > 0;
        if (!body.trim() && !hasPhotos) {
          await deleteEntry(current.id);
          entryByKey.current[key] = null;
        } else {
          const next = { ...current, body: body || (hasPhotos ? '📷' : ''), sync_status: 'pending', updated_at: now };
          await upsertEntry(next);
          entryByKey.current[key] = next;
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
        entryByKey.current[key] = created;
        void track('diary_written');
      }
      refreshPending();
    },
    [trip, refreshPending]
  );

  const onText = (key: string, t: string) => {
    setDrafts(d => ({ ...d, [key]: t }));
    dirty.current.add(key);
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => save(key, t), SAVE_DELAY_MS);
  };

  // Never lose the last words: save every unsaved page when leaving the screen.
  useEffect(
    () => () => {
      for (const t of Object.values(timers.current)) clearTimeout(t);
      for (const key of dirty.current) void save(key, latestDrafts.current[key] ?? '');
    },
    [save]
  );

  const sheets = useMemo(() => diarySheets(entries, today, todayKeys), [entries, today, todayKeys]);
  // Moods from every moment you wrote (journeys too), for the calendar; the diary's own writing streak.
  const [moodEntries, setMoodEntries] = useState<LocalEntry[]>([]);
  useEffect(() => {
    if (pickerOpen) listAllEntries().then(all => setMoodEntries(all.filter(e => !e.author_id))).catch(() => setMoodEntries(entries));
  }, [pickerOpen, entries]);
  const streak = useMemo(() => writingStreak(entries.filter(e => !e.author_id), today), [entries, today]);
  const active = sheets[page] ?? sheets[0];
  const activeKey = active?.editable ? active.key : null;

  // Anything else written today before days had one page (older app versions): shown under today's page.
  const todayExtras = useMemo(
    () => entries.filter(e => !e.author_id && dayOf(e.recorded_at) === today && !todayKeys.includes(e.id)),
    [entries, today, todayKeys]
  );

  const addPhoto = async () => {
    if (!trip || !activeKey) return;
    try {
      const picked = await pickPhotos(true);
      if (!picked.length) return;
      // A photo needs the page's entry to exist.
      if (!entryByKey.current[activeKey]) {
        const now = new Date().toISOString();
        const created: LocalEntry = { id: uuid(), trip_id: trip.id, recorded_at: now, body: drafts[activeKey] || '📷', mood: null, place_name: null, weather: null, latitude: null, longitude: null, altitude_m: null, sync_status: 'pending', updated_at: now };
        await upsertEntry(created);
        entryByKey.current[activeKey] = created;
      }
      const entry = entryByKey.current[activeKey]!;
      for (const p of picked) {
        const mediaId = uuid();
        const stored = await persistJournalPhoto(p.uri, mediaId, p);
        await upsertEntryMedia({ id: mediaId, trip_id: trip.id, entry_id: entry.id, local_uri: stored.uri, storage_path: null, mime_type: stored.mimeType, sync_status: 'pending', updated_at: new Date().toISOString() });
      }
      setMediaKey(k => k + 1);
      refreshPending();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add the photo');
    }
  };

  // Days that can be jumped to (today first), and the first sheet of each.
  const days = useMemo(() => [...new Set(sheets.map(s => s.day))].map(day => ({ day })), [sheets]);
  const goTo = (day: string) => {
    const { index, exact } = pageIndexFor(days, day);
    const sheetIndex = Math.max(0, sheets.findIndex(s => s.day === days[index].day));
    slide.setValue(0);
    setPage(sheetIndex);
    setFormatOpen(false);
    if (!exact) toast(`Nothing written on ${formatDay(day)} — showing ${index === 0 ? 'today' : formatDay(days[index].day)}`);
  };

  const openPicker = () => setPickerOpen(true);

  // One tap: the next paper style.
  const nextTheme = () => {
    const i = DIARY_THEMES.findIndex(t => t.id === themeId);
    const next = DIARY_THEMES[(i + 1) % DIARY_THEMES.length];
    setThemeId(next.id);
    toast(next.name);
    AsyncStorage.setItem(THEME_KEY, next.id).catch(() => undefined);
  };

  const applyEdit = (key: string, nextText: string, sel: Selection) => {
    onText(key, nextText);
    selection.current = sel;
    setForcedSelection(sel);
    setEditorKey(k => k + 1);
  };
  const wrap = (open_: string, close: string) => {
    if (!activeKey) return;
    const r = toggleWrap(drafts[activeKey] ?? '', selection.current, open_, close);
    if (!r) {
      toast('Select some words first');
      return;
    }
    applyEdit(activeKey, r.text, r.selection);
  };
  const heading = (kind: 'h1' | 'h2') => {
    if (!activeKey) return;
    const r = toggleLine(drafts[activeKey] ?? '', selection.current.start, kind);
    applyEdit(activeKey, r.text, { start: r.cursor, end: r.cursor });
  };
  const colorize = (c: RichColor) => wrap(`{${c}}`, '{/}');

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

  // Room for the floating tab bar (its height plus the phone's own bottom inset).
  const tabBarRoom = 80 + Math.max(insets.bottom, 10);

  /** Slide to the next day in a direction, then bring the new page in from the other side. */
  const turn = (dir: 'older' | 'newer') => {
    const out = dir === 'older' ? width : -width;
    Animated.timing(slide, { toValue: out, duration: 160, useNativeDriver: Platform.OS !== 'web' }).start(() => {
      setPage(p => (dir === 'older' ? p + 1 : p - 1));
      setFormatOpen(false);
      slide.setValue(-out);
      Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start();
    });
  };
  const sheetCount = useRef(1);
  sheetCount.current = sheets.length;
  // Sideways drags turn the day; anything else (scrolling, selecting words) is left to the page.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderMove: (_, g) => {
          const atEnd = (g.dx > 0 && pageRef.current >= sheetCount.current - 1) || (g.dx < 0 && pageRef.current === 0);
          slide.setValue(atEnd ? g.dx * 0.25 : g.dx);
        },
        onPanResponderRelease: (_, g) => {
          const outcome = swipeOutcome(g.dx, g.dy, pageRef.current, sheetCount.current);
          if (outcome === 'stay') Animated.spring(slide, { toValue: 0, useNativeDriver: Platform.OS !== 'web', bounciness: 4 }).start();
          else turn(outcome);
        },
        // Once a drag is clearly sideways it stays a swipe: the page's own scroll view must not take
        // it over half-way (that cancelled the swipe and snapped the page back).
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => Animated.spring(slide, { toValue: 0, useNativeDriver: Platform.OS !== 'web' }).start(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width]
  );

  /** "Write anywhere": a tap on an empty line below the writing adds lines so the pen lands there. */
  const tapToLine = (key: string, y: number) => {
    const add = linesToTap(y, contentHeight.current, DIARY_LINE_HEIGHT);
    if (!add) return;
    const next = (drafts[key] ?? '') + '\n'.repeat(add);
    onText(key, next);
    setForcedSelection({ start: next.length, end: next.length });
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

  const padLeft = theme.margin ? 46 : 20;

  /** The top of a sheet: the day's number large, the weekday and month, and the page. */
  const sheetHeader = (item: DiarySheet<LocalEntry>) => {
    const d = new Date(`${item.day}T12:00:00`);
    return (
      <View style={{ paddingTop: 14, paddingRight: 16, paddingLeft: padLeft, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ color: theme.ink, fontFamily: theme.font, fontSize: 34, fontWeight: '800', lineHeight: 38 }}>{d.getDate()}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.ink, fontFamily: theme.font, fontSize: 15, fontWeight: '700' }}>{d.toLocaleDateString('en-IN', { weekday: 'long' })}</Text>
          <Text style={{ color: theme.faint, fontFamily: theme.font, fontSize: 13 }}>{d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
        </View>
        {item.editable ? null : <Icon name="lock-outline" size={16} color={theme.faint} />}
      </View>
    );
  };

  const renderPage = (item: DiarySheet<LocalEntry>) => {
    const text = drafts[item.key] ?? '';
    const isActive = item.key === activeKey;
    const entryId = item.editable ? entryByKey.current[item.key]?.id ?? null : null;
    return (
      <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: tabBarRoom }}>
        <View style={{ flex: 1, borderRadius: 22, backgroundColor: theme.paper, overflow: 'hidden', borderWidth: theme.dark ? 0 : 1, borderColor: '#00000010' }}>
          {sheetHeader(item)}
          <View style={{ height: 1, backgroundColor: theme.rule ?? '#00000012', marginTop: 10, marginLeft: padLeft, marginRight: 16 }} />
          {item.editable ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
              <View style={{ flex: 1, minHeight: 400 }}>
                <Rules theme={theme} height={2400} />
                <NativeInput
                  key={`${item.key}-${isActive ? editorKey : 0}`}
                  // Phones show the formatting while you type; the web preview edits plain text.
                  {...(Platform.OS === 'web' ? { value: text } : {})}
                  onChangeText={t => onText(item.key, t)}
                  onSelectionChange={e => {
                    selection.current = e.nativeEvent.selection;
                    if (forcedSelection) setForcedSelection(undefined);
                  }}
                  onContentSizeChange={e => {
                    contentHeight.current = e.nativeEvent.contentSize.height;
                  }}
                  onPressIn={e => tapToLine(item.key, e.nativeEvent.locationY)}
                  selection={isActive ? forcedSelection : undefined}
                  autoFocus={isActive && editorKey > 0}
                  multiline
                  placeholder={promptFor(item.day, 1)}
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
                    paddingLeft: padLeft,
                    paddingRight: 20,
                    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
                  }}
                >
                  {Platform.OS === 'web' ? null : <RichText lines={parseRich(text)} theme={theme} editing />}
                </NativeInput>
              </View>
              {entryId ? (
                <View style={{ paddingBottom: 16 }}>
                  <MomentPhotos entryId={entryId} refreshKey={mediaKey} onChanged={() => setMediaKey(k => k + 1)} />
                </View>
              ) : null}
              {/* Older app versions could add more pages today: they stay readable below. */}
              {todayExtras.map(e => (
                <View key={e.id} style={{ paddingBottom: 12 }}>
                  <Text style={{ color: theme.faint, fontFamily: theme.font, fontSize: 13, paddingLeft: padLeft }}>
                    {new Date(e.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {e.body && e.body !== '📷' ? (
                    <Text style={{ color: theme.ink, fontFamily: theme.font, fontSize: 18, lineHeight: DIARY_LINE_HEIGHT, paddingLeft: padLeft, paddingRight: 20 }}>
                      <RichText lines={parseRich(e.body)} theme={theme} editing={false} />
                    </Text>
                  ) : null}
                  <MomentPhotos entryId={e.id} canEdit={false} />
                </View>
              ))}
            </ScrollView>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
              <View>
                <Rules theme={theme} height={Math.max(800, item.entries.length * 400)} />
                {item.entries.map((e, i) => (
                  <View key={e.id}>
                    {item.entries.length > 1 ? (
                      <Text style={{ color: theme.faint, fontFamily: theme.font, fontSize: 13, paddingLeft: padLeft, marginTop: i ? 12 : 6 }}>
                        {new Date(e.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    ) : null}
                    {e.body && e.body !== '📷' && e.body !== '🎙 Voice note' ? (
                      <Text style={{ color: theme.ink, fontFamily: theme.font, fontSize: 18, lineHeight: DIARY_LINE_HEIGHT, paddingTop: 10, paddingLeft: padLeft, paddingRight: 20 }}>
                        <RichText lines={parseRich(e.body)} theme={theme} editing={false} />
                      </Text>
                    ) : null}
                    <MomentPhotos entryId={e.id} canEdit={false} />
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
          {item.editable ? (
            // Writing tools along the bottom of today's page: a photo and text styles behind "A".
            <View style={{ borderTopWidth: 1, borderTopColor: '#00000012' }}>
              {formatOpen && isActive ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: 8, paddingTop: 4, gap: 2 }}>
                  <IconButton icon="format-bold" size={20} iconColor={theme.ink} onPress={() => wrap('**', '**')} accessibilityLabel="Bold" style={{ margin: 0 }} />
                  <IconButton icon="format-underline" size={20} iconColor={theme.ink} onPress={() => wrap('__', '__')} accessibilityLabel="Underline" style={{ margin: 0 }} />
                  <IconButton icon="format-header-1" size={20} iconColor={theme.ink} onPress={() => heading('h1')} accessibilityLabel="Heading" style={{ margin: 0 }} />
                  <IconButton icon="format-header-2" size={20} iconColor={theme.ink} onPress={() => heading('h2')} accessibilityLabel="Subheading" style={{ margin: 0 }} />
                  {(Object.keys(RICH_COLORS) as RichColor[]).map(c => (
                    <Pressable key={c} onPress={() => colorize(c)} accessibilityRole="button" accessibilityLabel={`${c} text`} hitSlop={4} style={{ padding: 6 }}>
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: RICH_COLORS[c] }} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
                <IconButton icon="image-plus" size={22} iconColor={theme.faint} onPress={addPhoto} accessibilityLabel="Add a photo to this page" />
                <IconButton
                  icon="format-color-text"
                  size={22}
                  iconColor={formatOpen ? colors.primary : theme.faint}
                  onPress={() => setFormatOpen(v => !v)}
                  accessibilityLabel={formatOpen ? 'Hide text styles' : 'Text styles: bold, underline, colour, headings'}
                />
                <View style={{ flex: 1 }} />
                <Text style={{ color: theme.faint, fontFamily: theme.font, fontSize: 12, marginRight: 10 }}>
                  {wordCount(text)} {wordCount(text) === 1 ? 'word' : 'words'}
                </Text>
              </View>
            </View>
          ) : null}
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
            {active?.editable ? `Today${streak >= 2 ? ` · 🔥 ${streak}-day streak` : ''}${sheets.length > 1 ? ' · swipe for other days' : ''}` : `${formatDay(active?.day ?? today)} · read only`}
          </Text>
        </View>
        {page !== 0 ? <IconButton icon="calendar-today" onPress={() => goTo(today)} accessibilityLabel="Back to today" /> : null}
        <IconButton icon="calendar-month-outline" onPress={openPicker} accessibilityLabel="Mood calendar: go to a day" />
        <IconButton icon="palette-outline" onPress={nextTheme} accessibilityLabel={`Diary style: ${theme.name}. Tap for the next one`} />
      </View>

      {/* One day at a time: drag sideways to turn to the day before or after. */}
      <Animated.View style={{ flex: 1, transform: [{ translateX: slide }] }} {...pan.panHandlers}>
        {active ? renderPage(active) : null}
      </Animated.View>

      {/* The month at a glance: moods and written days; tap one to open it. */}
      <MoodCalendar visible={pickerOpen} onClose={() => setPickerOpen(false)} entries={moodEntries} today={today} onPick={goTo} />
    </KeyboardAvoidingView>
  );
}
