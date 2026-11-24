import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../../context/ToastContext';
import { formatDateRange } from '../../lib/format';
import { addTripPhotos, askGalleryAccess, findTripPhotos, galleryAccess, snoozeTripPhotos } from '../../lib/galleryPhotos';
import type { LocalTrip } from '../../lib/localDb';
import { daysLabel, photosByDay, type GalleryPhoto } from '../../lib/tripGallery';
import { useAppTheme } from '../../theme';
import { Icon } from '../../ui/Icon';

const PREVIEW = 7;

/**
 * "38 photos from this trip": gallery photos taken on the journey's days, offered to add, already
 * sorted into Day 1, Day 2… Shown once a dated journey has started; asks for photo access on tap.
 */
export function TripGalleryCard({ trip, onAdded }: { trip: LocalTrip; onAdded: () => void }) {
  const { colors } = useAppTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [access, setAccess] = useState<'granted' | 'ask' | 'denied' | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const busy = useRef(false);

  const load = useCallback(async () => {
    const a = await galleryAccess().catch(() => 'denied' as const);
    setAccess(a);
    if (a === 'granted') setPhotos(await findTripPhotos(trip).catch(() => []));
  }, [trip]);
  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => (photos && trip.starts_on ? photosByDay(photos, trip.starts_on, trip.ends_on) : []), [photos, trip.starts_on, trip.ends_on]);
  const toggle = (id: string) => setChosen(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const add = async () => {
    if (busy.current || !photos) return;
    const picked = photos.filter(p => chosen.has(p.id));
    if (!picked.length) return setOpen(true);
    busy.current = true;
    setAdding(true);
    try {
      const days = await addTripPhotos(trip, picked);
      toast(`Added ${picked.length} ${picked.length === 1 ? 'photo' : 'photos'} to ${daysLabel(days)}`);
      setChosen(new Set());
      setOpen(false);
      setPhotos(prev => (prev ?? []).filter(p => !chosen.has(p.id)));
      onAdded();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add the photos');
    } finally {
      busy.current = false;
      setAdding(false);
    }
  };

  if (access === null) return null;
  const dates = formatDateRange(trip.starts_on, trip.ends_on);
  const card = { padding: 12, borderRadius: 16, marginBottom: 14, backgroundColor: colors.primaryContainer } as const;

  if (access === 'ask' || access === 'denied') {
    return (
      <View style={card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="image-multiple-outline" size={22} color={colors.onPrimaryContainer} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: colors.onPrimaryContainer }}>Add photos from these dates?</Text>
            <Text style={{ fontSize: 12, color: colors.onPrimaryContainer }}>Wayfare can look in your gallery for photos taken {dates || 'on this journey'}.</Text>
          </View>
        </View>
        <Button
          compact
          mode="contained"
          style={{ alignSelf: 'flex-start', marginTop: 8 }}
          onPress={async () => {
            if (access === 'denied') return void Linking.openSettings();
            if (await askGalleryAccess().catch(() => false)) void load();
            else setAccess('denied');
          }}
        >
          {access === 'denied' ? 'Allow photo access in Settings' : 'Look in my gallery'}
        </Button>
      </View>
    );
  }
  if (!photos || !photos.length) return null;

  const preview = photos.slice(0, PREVIEW);
  const thumb = (p: GalleryPhoto, size: number | `${number}%`) => {
    const on = chosen.has(p.id);
    return (
      <Pressable
        key={p.id}
        onPress={() => toggle(p.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={`Photo from ${new Date(p.creationTime).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`}
        style={{ width: size, aspectRatio: 1, borderRadius: 8, overflow: 'hidden' }}
      >
        <Image source={{ uri: p.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" recyclingKey={p.id} />
        <View style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#fff', backgroundColor: on ? colors.primary : 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' }}>
          {on ? <Icon name="check" size={12} color="#fff" /> : null}
        </View>
      </Pressable>
    );
  };
  const pickedDays = groups.filter(g => g.photos.some(p => chosen.has(p.id))).map(g => g.label);

  return (
    <View style={card}>
      <Text style={{ fontWeight: '800', color: colors.onPrimaryContainer }}>
        {photos.length} {photos.length === 1 ? 'photo' : 'photos'} from this trip
      </Text>
      <Text style={{ fontSize: 12, color: colors.onPrimaryContainer }}>Taken {dates}, still on your phone. Tap the ones to keep in your journal.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginVertical: 8 }}>
        {preview.map(p => thumb(p, '23.5%'))}
        {photos.length > PREVIEW ? (
          <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="See all photos from this trip" style={{ width: '23.5%', aspectRatio: 1, borderRadius: 8, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontWeight: '800', color: colors.primary }}>+{photos.length - PREVIEW}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button compact mode="contained" onPress={add} loading={adding} disabled={adding}>
          {chosen.size ? `Add ${chosen.size} to ${daysLabel(pickedDays)}` : 'Choose photos'}
        </Button>
        <Button
          compact
          onPress={() => {
            void snoozeTripPhotos(trip.id, photos);
            setPhotos([]);
          }}
        >
          Not now
        </Button>
      </View>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
            <IconButton icon="close" onPress={() => setOpen(false)} accessibilityLabel="Close" />
            <Text style={{ flex: 1, fontWeight: '800', fontSize: 16 }}>Photos from {dates}</Text>
            <Button compact onPress={() => setChosen(new Set(chosen.size === photos.length ? [] : photos.map(p => p.id)))}>
              {chosen.size === photos.length ? 'Select none' : 'Select all'}
            </Button>
          </View>
          <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 100 }}>
            {groups.map(g => (
              <View key={g.day} style={{ marginBottom: 14 }}>
                <Text style={{ fontWeight: '800', color: colors.primary, marginBottom: 6 }}>
                  {g.label} <Text style={{ color: colors.muted, fontWeight: '400' }}>· {g.photos.length}</Text>
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>{g.photos.map(p => thumb(p, '32.5%'))}</View>
              </View>
            ))}
          </ScrollView>
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(insets.bottom, 12) + 8 }}>
            {adding ? <ActivityIndicator /> : null}
            <Button mode="contained" onPress={add} disabled={!chosen.size || adding}>
              {chosen.size ? `Add ${chosen.size} to ${daysLabel(pickedDays)}` : 'Tap photos to choose'}
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}
