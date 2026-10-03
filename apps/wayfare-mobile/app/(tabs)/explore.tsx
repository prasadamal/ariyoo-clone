import { router } from 'expo-router';
import { ScrollView } from 'react-native';
import { Button, Card, Chip, Text } from 'react-native-paper';
import { TREK_GUIDES } from '../../src/content/treks';

export default function ExploreTab() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text variant="headlineSmall" style={{ marginBottom: 4 }}>Explore India</Text>
      <Text style={{ color: '#57534e', marginBottom: 16 }}>
        Curated Himalayan treks with permits, seasons, and connectivity—start a journal in one tap.
      </Text>
      {TREK_GUIDES.map(trek => (
        <Card key={trek.id} style={{ marginBottom: 14, backgroundColor: '#fff' }}>
          <Card.Title title={trek.name} subtitle={`${trek.region} · ${trek.difficulty}`} />
          <Card.Content>
            <Chip icon="weather-sunny" style={{ alignSelf: 'flex-start', marginBottom: 8 }} compact>
              {trek.bestSeason}
            </Chip>
            <Text variant="bodyMedium" style={{ fontWeight: '600' }}>Permits</Text>
            <Text style={{ marginBottom: 8 }}>{trek.permits}</Text>
            <Text variant="bodyMedium" style={{ fontWeight: '600' }}>Acclimatisation</Text>
            <Text style={{ marginBottom: 8 }}>{trek.acclimatisation}</Text>
            <Text variant="bodyMedium" style={{ fontWeight: '600' }}>Connectivity</Text>
            <Text style={{ marginBottom: 8 }}>{trek.connectivity}</Text>
            <Text variant="bodyMedium" style={{ fontWeight: '600' }}>Transport</Text>
            <Text style={{ marginBottom: 12 }}>{trek.transport}</Text>
            <Button
              mode="contained"
              onPress={() =>
                router.push({
                  pathname: '/trip/new',
                  params: { trekId: trek.id, title: trek.name, destination: trek.region, tripType: 'trek' },
                })
              }
            >
              Start {trek.name} journal
            </Button>
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
}
