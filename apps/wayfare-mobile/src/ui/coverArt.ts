/** Photo covers for journeys without a photo of their own, picked by the type of journey. */
const ART = {
  mountains: require('../../assets/covers/mountains.jpg'), // a road winding into snow peaks
  city: require('../../assets/covers/city.jpg'), // a lantern-lit old lane with a pagoda
  beach: require('../../assets/covers/beach.jpg'), // a quiet bay at dusk
  backwaters: require('../../assets/covers/backwaters.jpg'), // Kerala backwaters at sunrise
};

const BY_TYPE: Record<string, keyof typeof ART> = {
  trek: 'mountains',
  road: 'mountains',
  backpacking: 'mountains',
  city: 'city',
  international: 'city',
  pilgrimage: 'city',
  beach: 'beach',
  wildlife: 'backwaters',
};

/** A journey's type → its cover; custom types (and none) get the backwaters. */
export function coverArtFor(tripType: string | null | undefined): number {
  return ART[BY_TYPE[tripType ?? ''] ?? 'backwaters'];
}
