import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Switch, Text, TextInput } from 'react-native-paper';
import * as SecureStore from 'expo-secure-store';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { getApiBaseUrl } from '../../src/config';

export default function ProfileTab() {
  const { user, signOut, refreshUser } = useAuth();
  const [userName, setUserName] = useState('');
  const [isSolver, setIsSolver] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setUserName(user.userName || '');
      setIsSolver(!!user.isSolver);
    }
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await api.put('/api/user', {
        id: user.userId,
        userName,
        fullName: user.fullName,
        isSolver,
      });
      const updated = { ...user, userName, isSolver };
      await SecureStore.setItemAsync('user', JSON.stringify(updated));
      await refreshUser();
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text variant="titleLarge" style={{ marginBottom: 4 }}>{user.fullName}</Text>
      <Text style={{ color: '#94a3b8', marginBottom: 24 }}>{user.email}</Text>
      <TextInput mode="outlined" label="Username" value={userName} onChangeText={setUserName} style={{ marginBottom: 16 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text variant="titleMedium">Expert (Solver) mode</Text>
          <Text style={{ color: '#94a3b8' }}>Receive matched questions from seekers.</Text>
        </View>
        <Switch value={isSolver} onValueChange={setIsSolver} />
      </View>
      <Button mode="contained" onPress={save} loading={saving} style={{ marginBottom: 12 }}>
        Save profile
      </Button>
      <Button mode="outlined" onPress={signOut} textColor="#f87171">
        Sign out
      </Button>
      <Text style={{ color: '#64748b', marginTop: 24, fontSize: 12 }}>API: {getApiBaseUrl()}</Text>
      <Text style={{ color: '#64748b', fontSize: 12 }}>Version 1.0.0</Text>
    </ScrollView>
  );
}
