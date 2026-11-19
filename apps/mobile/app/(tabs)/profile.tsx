import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { Button, Chip, Dialog, Divider, List, Portal, Switch, Text, TextInput } from 'react-native-paper';
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
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text variant="titleLarge" style={{ marginBottom: 4 }}>{user.fullName}</Text>
      <Text style={{ color: '#94a3b8', marginBottom: stats ? 8 : 24 }}>{user.email}</Text>
      {stats ? (
        <Text style={{ color: '#cbd5e1', marginBottom: 24 }}>
          {stats.asked === 1 ? '1 question asked' : `${stats.asked} questions asked`}
          {user.isSolver ? ` · ${expertRecord(stats)}` : ''}
        </Text>
      ) : null}
      <TextInput mode="outlined" label="Username (optional)" value={userName} onChangeText={setUserName} autoCapitalize="none" autoCorrect={false} maxLength={30} style={{ marginBottom: 16 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text variant="titleMedium">Answer questions as an expert</Text>
          <Text style={{ color: '#94a3b8' }}>Get questions on your topics, and pick up open ones.</Text>
        </View>
        <Switch value={isSolver} onValueChange={setIsSolver} accessibilityLabel="Answer questions as an expert" />
      </View>
      {notice ? <Text accessibilityRole="alert" style={{ color: notice.ok ? '#4ade80' : '#f87171', marginBottom: 12 }}>{notice.text}</Text> : null}
      <Button mode="contained" onPress={save} loading={saving} disabled={saving || !dirty} style={{ marginBottom: 24 }}>
        Save profile
      </Button>

      {user.isSolver ? (
        <View style={{ marginBottom: 24 }}>
          <Text variant="titleMedium" style={{ marginBottom: 4 }}>Your topics</Text>
          <Text style={{ color: '#94a3b8', marginBottom: 12 }}>Questions tagged with these come to you first. Add places and subjects you really know.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {topics.map(t => <Chip key={t.tagId} onClose={() => removeTopic(t)}>#{t.tagName}</Chip>)}
            {topics.length === 0 ? <Text style={{ color: '#fbbf24' }}>No topics yet. You will only see the open queue until you add some.</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput mode="outlined" dense label="Add a topic" value={newTopic} onChangeText={setNewTopic} autoCapitalize="none" maxLength={40} onSubmitEditing={addTopic} style={{ flex: 1 }} />
            <Button mode="contained-tonal" onPress={addTopic} loading={topicBusy} disabled={topicBusy || !newTopic.trim()}>Add</Button>
          </View>
        </View>
      ) : null}

      {blocked.length > 0 ? (
        <View style={{ marginBottom: 24 }}>
          <Text variant="titleMedium" style={{ marginBottom: 4 }}>Blocked people</Text>
          {blocked.map(b => (
            <List.Item key={b.userId} title={b.fullName} style={{ paddingHorizontal: 0 }} right={() => <Button compact onPress={() => unblock(b)}>Unblock</Button>} />
          ))}
        </View>
      ) : null}

      <Divider style={{ marginBottom: 8 }} />
      <List.Item title="Change password" left={p => <List.Icon {...p} icon="lock-reset" />} onPress={() => { setPw({ current: '', next: '', again: '' }); setPwError(''); setChanging(true); }} style={{ paddingHorizontal: 0 }} />
      <List.Item title="Terms of Use" left={p => <List.Icon {...p} icon="file-document-outline" />} onPress={() => open(TERMS_URL)} style={{ paddingHorizontal: 0 }} />
      <List.Item title="Privacy Policy" left={p => <List.Icon {...p} icon="shield-lock-outline" />} onPress={() => open(PRIVACY_URL)} style={{ paddingHorizontal: 0 }} />
      <List.Item title="Contact support" description={SUPPORT_EMAIL} left={p => <List.Icon {...p} icon="email-outline" />} onPress={() => open(`mailto:${SUPPORT_EMAIL}`)} style={{ paddingHorizontal: 0 }} />
      <Divider style={{ marginVertical: 8 }} />

      <Button mode="outlined" onPress={() => signOut()} style={{ marginTop: 8, marginBottom: 12 }}>
        Sign out
      </Button>
      <Button mode="text" textColor="#f87171" onPress={() => { setPassword(''); setDeleteError(''); setDeleting(true); }}>
        Delete account
      </Button>
      <Text style={{ color: '#64748b', fontSize: 12, marginTop: 16, textAlign: 'center' }}>Ariyoo {APP_VERSION}</Text>

      <Portal>
        <Dialog visible={changing} onDismiss={() => { if (!pwBusy) setChanging(false); }}>
          <Dialog.Title>Change password</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" label="Current password" value={pw.current} onChangeText={v => setPw(c => ({ ...c, current: v }))} secureTextEntry autoComplete="current-password" style={{ marginBottom: 8 }} />
            <TextInput mode="outlined" label="New password (12+ characters)" value={pw.next} onChangeText={v => setPw(c => ({ ...c, next: v }))} secureTextEntry autoComplete="new-password" style={{ marginBottom: 8 }} />
            <TextInput mode="outlined" label="New password again" value={pw.again} onChangeText={v => setPw(c => ({ ...c, again: v }))} secureTextEntry autoComplete="new-password" onSubmitEditing={changePassword} />
            {pwError ? <Text accessibilityRole="alert" style={{ color: '#f87171', marginTop: 8 }}>{pwError}</Text> : null}
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
            {deleteError ? <Text accessibilityRole="alert" style={{ color: '#f87171', marginTop: 8 }}>{deleteError}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleting(false)} disabled={deleteBusy}>Keep my account</Button>
            <Button onPress={deleteAccount} loading={deleteBusy} disabled={deleteBusy || !password} textColor="#f87171">Delete forever</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}
