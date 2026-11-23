/** Illustrated covers for journeys without a photo, picked by the type of journey. */
const ART = {
  mountains: require('../../assets/covers/mountains.jpg'),
  flight: require('../../assets/covers/flight.jpg'),
  beach: require('../../assets/covers/beach.jpg'),
  city: require('../../assets/covers/city.jpg'),
};

const BY_TYPE: Record<string, keyof typeof ART> = {
  trek: 'mountains',
  wildlife: 'mountains',
  pilgrimage: 'mountains',
  road: 'mountains',
  beach: 'beach',
  city: 'city',
  international: 'flight',
  backpacking: 'flight',
};

export function coverArtFor(tripType: string | null | undefined): number {
  return ART[BY_TYPE[tripType ?? ''] ?? 'flight'];
}
