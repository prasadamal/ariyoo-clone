import { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { ActivityIndicator, Searchbar, Text } from 'react-native-paper';
import { FollowButton } from '../src/components/FollowButton';
import { GuidelinesGate } from '../src/components/GuidelinesGate';
import { UserRow } from '../src/components/UserRow';
import { searchTravellers, suggestedTravellers } from '../src/social/profiles';
import { styleLabel, type TravellerSummary } from '../src/social/types';
import { useAppTheme } from '../src/theme';
import { EmptyState } from '../src/ui/EmptyState';

function SearchBody() {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TravellerSummary[]>([]);
  const [suggested, setSuggested] = useState<TravellerSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    suggestedTravellers(15).then(setSuggested).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      searchTravellers(query)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const searching = query.trim().length >= 2;
  const data = searching ? results : suggested;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 16, paddingBottom: 4 }}>
        <Searchbar placeholder="Name or @username" value={query} onChangeText={setQuery} autoCapitalize="none" autoFocus />
        <Text style={{ color: colors.muted, marginTop: 10, fontWeight: '700', fontSize: 12 }}>
          {searching ? (loading ? 'Searching…' : `${results.length} traveller${results.length === 1 ? '' : 's'}`) : 'SUGGESTED FOR YOU'}
        </Text>
      </View>
      <FlatList
        data={data}
        keyExtractor={r => r.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loading ? <ActivityIndicator style={{ margin: 20 }} /> : searching ? <EmptyState compact icon="account-search-outline" title="No travellers found" /> : null
        }
        renderItem={({ item }) => (
          <UserRow
            id={item.id}
            username={item.username}
            name={item.display_name}
            avatarPath={item.avatar_path}
            tier={item.tier}
            subtitle={[item.home_region, ...(item.travel_styles ?? []).slice(0, 2).map(styleLabel)].filter(Boolean).join(' · ') || undefined}
            right={<FollowButton userId={item.id} following={!!item.followed_by_me} />}
          />
        )}
      />
    </View>
  );
}

export default function SearchScreen() {
  return (
    <GuidelinesGate what="find travellers">
      <SearchBody />
    </GuidelinesGate>
  );
}
