import { ScrollView, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { TREK_GUIDES } from '../../src/content/treks';

export default function ExploreTab() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text variant="headlineSmall" style={{ marginBottom: 8 }}>Trek guides (India)</Text>
      <Text style={{ color: '#57534e', marginBottom: 16 }}>
        Utility slice for Himalayan beachhead — permits, seasons, connectivity, and transport.
      </Text>
      {TREK_GUIDES.map(trek => (
        <Card key={trek.id} style={{ marginBottom: 12 }}>
          <Card.Title title={trek.name} subtitle={`${trek.region} · ${trek.difficulty}`} />
          <Card.Content>
            <Text>Best season: {trek.bestSeason}</Text>
            <Text style={{ marginTop: 6 }}>Permits: {trek.permits}</Text>
            <Text style={{ marginTop: 6 }}>Acclimatisation: {trek.acclimatisation}</Text>
            <Text style={{ marginTop: 6, fontWeight: '600' }}>Connectivity</Text>
            <Text>{trek.connectivity}</Text>
            <Text style={{ marginTop: 6, fontWeight: '600' }}>Transport</Text>
            <Text>{trek.transport}</Text>
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
}
