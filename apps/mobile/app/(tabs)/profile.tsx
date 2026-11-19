import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, Text as RNText, View } from 'react-native';
import { Button, Chip, Dialog, List, Portal, Switch, Text, TextInput } from 'react-native-paper';
import { radius, space, type, useTokens } from '../../src/design/tokens';
import { Avatar, Card, Notice, Pill, SectionLabel } from '../../src/design/ui';
import { api, errorMessage, type Profile } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { APP_VERSION, PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '../../src/config';
import { expertRecord } from '../../src/lib/resolve';
import { cleanTopic, passwordProblem } from '../../src/lib/validation';
import { registerForPush } from '../../src/notifications';

type Topic = { tagId: number; tagName: string };
type Blocked = { userId: number; fullName: string };
type Stats = { asked: number; answered: number; helpful: number };

const open = (url: string) => Linking.openURL(url).catch(() => undefined);

export default function ProfileTab() {
  const { user, signOut, applyProfile } = useAuth();
  const { c } = useTokens();
  const [userName, setUserName] = useState('');
  const [isSolver, setIsSolver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [topicBusy, setTopicBusy] = useState(false);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [changing, setChanging] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', again: '' });
  const [pwError, setPwError] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const userId = user?.userId;

  useEffect(() => {
    if (user) {
      setUserName(user.userName || '');
      setIsSolver(!!user.isSolver);
    }
    // Only when the account changes: typing must not be overwritten by a background refresh.
  }, [userId]);

  const loadExtras = useCallback(async () => {
    if (!userId) return;
    const [t, b, st] = await Promise.all([
      api.get<Topic[]>(`/api/Tags/getUserTags/${userId}`).catch(() => null),
      api.get<Blocked[]>('/api/safety/blocks').catch(() => null),
      api.get<Stats>('/api/user/stats').catch(() => null),
    ]);
    if (t) setTopics(t.data);
    if (b) setBlocked(b.data);
    if (st) setStats(st.data);
  }, [userId]);
  useEffect(() => { void loadExtras(); }, [loadExtras]);

  const save = async () => {
    if (!user || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await api.put<Profile>('/api/user', { userName: userName.trim(), fullName: user.fullName, isSolver });
      await applyProfile(res.data);
      // Experts need alerts to know a question arrived; ask at the moment they opt in.
      if (res.data.isSolver) void registerForPush(true);
      setNotice({ ok: true, text: 'Saved.' });
    } catch (e: unknown) {
      setNotice({ ok: false, text: errorMessage(e, 'Could not save. Please try again.') });
    } finally {
      setSaving(false);
    }
  };

  const addTopic = async () => {
    const topic = cleanTopic(newTopic);
    if (!topic) return setNotice({ ok: false, text: 'Topics are 2–40 letters or numbers, like "goa" or "street food".' });
    if (topicBusy) return;
    setTopicBusy(true);
    setNotice(null);
    try {
      await api.post('/api/Tags/addUserTags', [{ tagName: topic }]);
      setNewTopic('');
      await loadExtras();
    } catch (e: unknown) {
      setNotice({ ok: false, text: errorMessage(e, 'Could not add that topic.') });
    } finally {
      setTopicBusy(false);
    }
  };

  const removeTopic = async (topic: Topic) => {
    setTopics(current => current.filter(t => t.tagId !== topic.tagId));
    await api.delete(`/api/Tags/deleteUserTag/${userId}/${topic.tagId}`).catch(() => undefined);
    void loadExtras();
  };

  const unblock = async (person: Blocked) => {
    setBlocked(current => current.filter(b => b.userId !== person.userId));
    await api.delete(`/api/safety/block/${person.userId}`).catch(() => undefined);
    void loadExtras();
  };

  const changePassword = async () => {
    if (pwBusy) return;
    const problem = !pw.current ? 'Enter your current password.' : passwordProblem(pw.next) ?? (pw.next !== pw.again ? 'The new passwords do not match.' : pw.next === pw.current ? 'Choose a password you have not used here.' : null);
    if (problem) return setPwError(problem);
    setPwBusy(true);
    setPwError('');
    try {
      await api.put('/api/user/updatepassword', { oldPassword: pw.current, newPassword: pw.next });
      setChanging(false);
      setPw({ current: '', next: '', again: '' });
      setNotice({ ok: true, text: 'Password changed.' });
    } catch (e: unknown) {
      setPwError(errorMessage(e, 'Could not change the password. Please try again.'));
    } finally {
      setPwBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteBusy || !password) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await api.delete('/api/user', { data: { password } });
      setDeleting(false);
      await signOut({ remote: false });
    } catch (e: unknown) {
      setDeleteError(errorMessage(e, 'Could not delete the account. Please try again.'));
    } finally {
      setDeleteBusy(false);
    }
  };

  if (!user) return null;
  const dirty = userName.trim() !== (user.userName || '') || isSolver !== !!user.isSolver;

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
      <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
        <Avatar name={user.fullName} size={72} />
        <RNText accessibilityRole="header" style={[type.title, { color: c.text, marginTop: space.md, textAlign: 'center' }]}>{user.fullName}</RNText>
        <RNText style={[type.small, { color: c.textMuted, marginTop: 2 }]}>{user.email}</RNText>
        {user.isSolver ? <View style={{ marginTop: space.sm }}><Pill label="Local expert" tone="expert" /></View> : null}
        {stats ? (
          <View style={{ flexDirection: 'row', alignSelf: 'stretch', marginTop: space.lg, borderTopWidth: 1, borderTopColor: c.border, paddingTop: space.lg }}>
            {[
              { value: stats.asked, label: 'Asked' },
              ...(user.isSolver ? [{ value: stats.answered, label: 'Answered' }, { value: stats.helpful, label: 'Helped' }] : []),
            ].map(s => (
              <View key={s.label} style={{ flex: 1, alignItems: 'center' }} accessible accessibilityLabel={`${s.value} ${s.label}`}>
                <RNText style={{ color: c.text, fontSize: 22, fontWeight: '800' }}>{s.value}</RNText>
                <RNText style={[type.small, { color: c.textMuted }]}>{s.label}</RNText>
              </View>
            ))}
          </View>
        ) : null}
        {user.isSolver && stats ? <RNText style={[type.small, { color: c.textFaint, marginTop: space.md }]}>{expertRecord(stats)}</RNText> : null}
      </Card>

      <SectionLabel>Your profile</SectionLabel>
      <Card>
        <TextInput mode="outlined" label="Username (optional)" value={userName} onChangeText={setUserName} autoCapitalize="none" autoCorrect={false} maxLength={30} style={{ marginBottom: space.lg, backgroundColor: c.surface }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg }}>
          <View style={{ flex: 1, paddingRight: space.md }}>
            <RNText style={[type.bodyStrong, { color: c.text }]}>Answer as a local expert</RNText>
            <RNText style={[type.small, { color: c.textMuted }]}>Get questions on your topics, and pick up open ones.</RNText>
          </View>
          <Switch value={isSolver} onValueChange={setIsSolver} accessibilityLabel="Answer questions as an expert" />
        </View>
        {notice ? <Notice text={notice.text} tone={notice.ok ? 'success' : 'danger'} /> : null}
        <Button mode="contained" onPress={save} loading={saving} disabled={saving || !dirty} style={{ borderRadius: radius.md }} contentStyle={{ height: 48 }}>
          Save changes
        </Button>
      </Card>

      {user.isSolver ? (
        <>
          <SectionLabel>Your topics</SectionLabel>
          <Card>
            <RNText style={[type.small, { color: c.textMuted, marginBottom: space.md }]}>Questions tagged with these come to you first. Add places and subjects you really know.</RNText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md }}>
              {topics.map(t => <Chip key={t.tagId} onClose={() => removeTopic(t)} closeIconAccessibilityLabel={`Remove ${t.tagName}`}>#{t.tagName}</Chip>)}
              {topics.length === 0 ? <Notice text="No topics yet. You will only see the open queue until you add some." /> : null}
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
              <TextInput mode="outlined" dense label="Add a topic" placeholder="e.g. kochi" value={newTopic} onChangeText={setNewTopic} autoCapitalize="none" maxLength={40} onSubmitEditing={addTopic} style={{ flex: 1, backgroundColor: c.surface }} />
              <Button mode="contained-tonal" onPress={addTopic} loading={topicBusy} disabled={topicBusy || !newTopic.trim()}>Add</Button>
            </View>
          </Card>
        </>
      ) : null}

      {blocked.length > 0 ? (
        <>
          <SectionLabel>Blocked people</SectionLabel>
          <Card style={{ paddingVertical: space.xs }}>
            {blocked.map(b => (
              <List.Item key={b.userId} title={b.fullName} titleStyle={{ color: c.text }} left={() => <Avatar name={b.fullName} size={36} />} style={{ paddingHorizontal: 0 }} right={() => <Button compact onPress={() => unblock(b)}>Unblock</Button>} />
            ))}
          </Card>
        </>
      ) : null}

      <SectionLabel>Account and help</SectionLabel>
      <Card style={{ paddingVertical: space.xs }}>
        {[
          { title: 'Change password', icon: 'lock-reset', onPress: () => { setPw({ current: '', next: '', again: '' }); setPwError(''); setChanging(true); } },
          { title: 'Contact support', icon: 'email-outline', description: SUPPORT_EMAIL, onPress: () => open(`mailto:${SUPPORT_EMAIL}`) },
          { title: 'Terms of Use', icon: 'file-document-outline', onPress: () => open(TERMS_URL) },
          { title: 'Privacy Policy', icon: 'shield-lock-outline', onPress: () => open(PRIVACY_URL) },
        ].map((row, i) => (
          <List.Item key={row.title} title={row.title} description={row.description} titleStyle={{ color: c.text, fontWeight: '600' }} descriptionStyle={{ color: c.textMuted }}
            left={p => <List.Icon {...p} icon={row.icon} color={c.accent} />} right={p => <List.Icon {...p} icon="chevron-right" color={c.textFaint} />}
            onPress={row.onPress} accessibilityRole="button"
            style={{ paddingHorizontal: 0, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }} />
        ))}
      </Card>

      <Button mode="outlined" onPress={() => signOut()} style={{ marginTop: space.xl, borderRadius: radius.md }} contentStyle={{ height: 48 }}>
        Sign out
      </Button>
      <Button mode="text" textColor={c.danger} onPress={() => { setPassword(''); setDeleteError(''); setDeleting(true); }} style={{ marginTop: space.sm }}>
        Delete account
      </Button>
      <RNText style={[type.small, { color: c.textFaint, marginTop: space.lg, textAlign: 'center' }]}>Ariyoo {APP_VERSION}</RNText>

      <Portal>
        <Dialog visible={changing} onDismiss={() => { if (!pwBusy) setChanging(false); }}>
          <Dialog.Title>Change password</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" label="Current password" value={pw.current} onChangeText={v => setPw(c => ({ ...c, current: v }))} secureTextEntry autoComplete="current-password" style={{ marginBottom: 8 }} />
            <TextInput mode="outlined" label="New password (12+ characters)" value={pw.next} onChangeText={v => setPw(c => ({ ...c, next: v }))} secureTextEntry autoComplete="new-password" style={{ marginBottom: 8 }} />
            <TextInput mode="outlined" label="New password again" value={pw.again} onChangeText={v => setPw(c => ({ ...c, again: v }))} secureTextEntry autoComplete="new-password" onSubmitEditing={changePassword} />
            {pwError ? <Text accessibilityRole="alert" style={{ color: c.danger, marginTop: 8 }}>{pwError}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setChanging(false)} disabled={pwBusy}>Cancel</Button>
            <Button onPress={changePassword} loading={pwBusy} disabled={pwBusy}>Change</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={deleting} onDismiss={() => { if (!deleteBusy) setDeleting(false); }}>
          <Dialog.Title>Delete your account?</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 12 }}>
              This permanently deletes your account, your questions and answers, your photos and your topics. It cannot be undone.
            </Text>
            <TextInput mode="outlined" label="Your password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
            {deleteError ? <Text accessibilityRole="alert" style={{ color: c.danger, marginTop: 8 }}>{deleteError}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleting(false)} disabled={deleteBusy}>Keep my account</Button>
            <Button onPress={deleteAccount} loading={deleteBusy} disabled={deleteBusy || !password} textColor={c.danger}>Delete forever</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}
