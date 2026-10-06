export const TRIP_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'trek', label: 'Trek', icon: 'hiking' },
  { value: 'road', label: 'Road trip', icon: 'car-side' },
  { value: 'backpacking', label: 'Backpacking', icon: 'bag-personal-outline' },
  { value: 'city', label: 'City', icon: 'city-variant-outline' },
  { value: 'beach', label: 'Beach', icon: 'beach' },
  { value: 'pilgrimage', label: 'Pilgrimage', icon: 'meditation' },
  { value: 'wildlife', label: 'Wildlife', icon: 'paw' },
  { value: 'international', label: 'Abroad', icon: 'airplane' },
];

const BASE: Record<string, string[]> = {
  trek: [
    'Broken-in trekking shoes',
    'Layered clothing + rain shell',
    'Headlamp + spare batteries',
    'Water bottles / hydration',
    'Water purification tablets',
    'First aid + personal meds',
    'Sunscreen & lip balm',
    'Snacks & electrolytes',
    'Trekking poles',
    'Backpack rain cover',
    'ID, permits & cash in a waterproof pouch',
  ],
  road: [
    'Licence, RC & insurance papers',
    'Spare tyre & tool kit',
    'Offline maps downloaded',
    'Car charger & cables',
    'First aid kit',
    'Snacks & water',
    'Power bank',
  ],
  backpacking: [
    'ID / passport + photocopies',
    'Padlock for hostel lockers',
    'Microfibre towel',
    'Universal adapter',
    'Headlamp',
    'Reusable water bottle',
    'Travel insurance details',
  ],
  city: ['Comfortable walking shoes', 'Day pack', 'Power bank', 'Reusable water bottle', 'Offline city map', 'Universal adapter'],
  beach: ['Swimwear', 'Reef-safe sunscreen', 'Sunglasses & hat', 'Flip-flops', 'Dry bag for phone', 'After-sun / aloe gel'],
  pilgrimage: ['Modest clothing', 'Slip-on footwear', 'Small purse for offerings', 'Water bottle', 'Rain poncho', 'Personal meds'],
  wildlife: ['Neutral-coloured clothing', 'Binoculars', 'Camera + zoom lens', 'Insect repellent', 'Safari permit printouts', 'Cap & sunscreen'],
  international: [
    'Passport (6+ months validity)',
    'Visa / e-visa printout',
    'Travel insurance',
    'Forex card + some cash',
    'Universal adapter',
    'Offline maps & translator',
    'Document copies in the cloud',
  ],
};

const HIGH_ALTITUDE = [
  'Down jacket & thermal base layers',
  'Gloves, beanie & buff',
  'UV400 sunglasses',
  'Altitude meds — consult a doctor before the trip',
];

const WINTER = ['Microspikes & gaiters', 'Hand & toe warmers'];

/** Packing list for a new journey, adapted to the destination's altitude and season. */
export function packingTemplate(tripType: string, opts: { maxAltitudeM?: number; startMonth?: number | null } = {}) {
  const list = [...(BASE[tripType] ?? BASE.trek)];
  if ((opts.maxAltitudeM ?? 0) >= 3500) list.push(...HIGH_ALTITUDE);
  const m = opts.startMonth;
  if ((opts.maxAltitudeM ?? 0) >= 2500 && m != null && [11, 12, 1, 2, 3].includes(m)) list.push(...WINTER);
  return Array.from(new Set(list));
}
