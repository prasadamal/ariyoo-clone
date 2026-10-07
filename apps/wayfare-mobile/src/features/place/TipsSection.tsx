import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { ReportDialog } from '../../components/ReportDialog';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { displayName, timeAgo } from '../../lib/format';
import { TIP_CATEGORIES, addTip, deleteTip, listTips, setTipVote, tipCategoryMeta } from '../../social/places';
import type { PlaceTip, TipCategory } from '../../social/types';
import { useAppTheme } from '../../theme';
import { ChipSelect } from '../../ui/ChipSelect';
import { Icon } from '../../ui/Icon';
import { SectionHeader } from '../../ui/SectionHeader';

export function TipsSection({ placeKey, placeName }: { placeKey: string; placeName: string }) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const toast = useToast();
  const [tips, setTips] = useState<PlaceTip[]>([]);
  const [filter, setFilter] = useState<TipCategory | null>(null);
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState<TipCategory>('general');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);

  const load = useCallback(async () => setTips(await listTips(placeKey).catch(() => [])), [placeKey]);

  useEffect(() => {
    load();
  }, [load]);

  const vote = async (t: PlaceTip) => {
    if (t.user_id === user?.id) return;
    const next = !t.voted_by_me;
    setTips(prev => prev.map(x => (x.id === t.id ? { ...x, voted_by_me: next, upvotes: x.upvotes + (next ? 1 : -1) } : x)));
    try {
      await setTipVote(t.id, next);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not vote');
      load();
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      await addTip(placeKey, placeName, category, body);
      setBody('');
      setAdding(false);
      toast('Thanks for helping fellow travellers 🙏');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add tip');
    } finally {
      setBusy(false);
    }
  };

  const options = (t: PlaceTip) =>
    Alert.alert('Tip', undefined, [
      ...(t.user_id === user?.id
        ? [
            {
              text: 'Delete',
              style: 'destructive' as const,
              onPress: async () => {
                await deleteTip(t.id).catch(() => undefined);
                load();
              },
            },
          ]
        : [{ text: 'Report', onPress: () => setReporting(t.id) }]),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  const visible = filter ? tips.filter(t => t.category === filter) : tips;

  return (
    <View>
      <SectionHeader
        title="Traveller tips"
        subtitle="Upvoted by people who have been there"
        action={adding ? 'Cancel' : 'Add tip'}
        onAction={() => setAdding(!adding)}
      />
      {adding ? (
        <View style={{ gap: 8, marginBottom: 12 }}>
          <ChipSelect scroll options={TIP_CATEGORIES} value={category} onChange={setCategory} />
          <TextInput
            mode="outlined"
            label="Your tip"
            placeholder="e.g. Refill water at the stream before the last camp"
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={1000}
          />
          <Button mode="contained" onPress={submit} loading={busy} disabled={busy || body.trim().length < 3}>
            Share tip
          </Button>
        </View>
      ) : null}
      {tips.length ? (
        <ChipSelect
          scroll
          allowDeselect
          options={TIP_CATEGORIES.filter(c => tips.some(t => t.category === c.value))}
          value={filter}
          onChange={v => setFilter((v || null) as TipCategory | null)}
        />
      ) : null}
      {visible.length ? (
        visible.slice(0, 20).map(t => {
          const meta = tipCategoryMeta(t.category);
          return (
            <Pressable
              key={t.id}
              onLongPress={() => options(t)}
              style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
            >
              <Pressable
                onPress={() => vote(t)}
                style={{ alignItems: 'center', width: 40 }}
                accessibilityRole="button"
                accessibilityLabel={`${t.voted_by_me ? 'Remove upvote' : 'Upvote'}, ${t.upvotes}`}
              >
                <Icon name={t.voted_by_me ? 'arrow-up-bold' : 'arrow-up-bold-outline'} size={22} color={t.voted_by_me ? colors.primary : colors.muted} />
                <Text style={{ fontWeight: '800', color: t.voted_by_me ? colors.primary : colors.onSurfaceVariant }}>{t.upvotes}</Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: colors.secondary, fontWeight: '700' }}>
                  <Icon name={meta.icon} size={12} color={colors.secondary} /> {meta.label}
                </Text>
                <Text style={{ marginTop: 2, lineHeight: 20 }}>{t.body}</Text>
                <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
                  {displayName({ display_name: t.author_display_name, username: t.author_username })} · {timeAgo(t.created_at)}
                </Text>
              </View>
            </Pressable>
          );
        })
      ) : (
        <Text style={{ color: colors.muted }}>No tips yet — be the first to help someone heading here.</Text>
      )}
      {reporting ? <ReportDialog visible onDismiss={() => setReporting(null)} targetType="tip" targetId={reporting} /> : null}
    </View>
  );
}
