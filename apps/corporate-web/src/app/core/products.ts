/** The apps Ariyoo makes. Features listed here exist in the apps today; keep it that way. */
export interface Screen { src: string; alt: string; }
export interface ProductInfo {
  id: 'ariyoo' | 'wayfare' | 'reelmates';
  name: string;
  category: string;
  tagline: string;
  description: string;
  features: string[];
  /** Brand colour, and a readable text colour on top of it. */
  color: string;
  onColor: string;
  screens: Screen[];
}

export const PRODUCTS: ProductInfo[] = [
  {
    id: 'ariyoo',
    name: 'Ariyoo',
    category: 'Local answers',
    tagline: 'Ask a local. Get a real answer.',
    description: 'Ask about any place and get matched with a local expert who knows it first-hand, in a private conversation built for safety.',
    features: [
      'Questions reach local experts by topic, or wait in an open queue for any expert',
      'Private chat with photos, visible only to the two people in it',
      'Askers mark questions answered and say whether they helped',
      'A personal library to search past answers and save the best ones',
      'Report, block and moderation built into every conversation',
    ],
    color: '#0e7a5f',
    onColor: '#ffffff',
    screens: [
      { src: 'apps/ariyoo-1.webp', alt: 'Ariyoo: asking a question about a place' },
      { src: 'apps/ariyoo-2.webp', alt: 'Ariyoo: your library of saved answers' },
      { src: 'apps/ariyoo-3.webp', alt: 'Ariyoo: a conversation with a local expert' },
    ],
  },
  {
    id: 'wayfare',
    name: 'Wayfare',
    category: 'Travel journal',
    tagline: 'Every journey, and every day in between.',
    description: 'A travel journal that works offline: write, add photos and voice notes, plan and budget trips, and keep a private everyday journal between journeys.',
    features: [
      'Journal moments offline with photos, voice notes, place and weather',
      'A private everyday journal, with "On this day" memories from past years',
      'Plan days, track a budget, split costs and pack from past trip lists',
      'Safety tools: SOS, live location sharing and check-in reminders',
      'Find travellers heading the same way, when you choose to',
    ],
    color: '#c2410c',
    onColor: '#ffffff',
    screens: [
      { src: 'apps/wayfare-1.webp', alt: 'Wayfare: home with "How was today?" and On this day memories' },
      { src: 'apps/wayfare-2.webp', alt: 'Wayfare: writing in the everyday journal' },
      { src: 'apps/wayfare-3.webp', alt: 'Wayfare: safety tools with SOS and live location' },
    ],
  },
  {
    id: 'reelmates',
    name: 'ReelMates',
    category: 'Film taste',
    tagline: 'Your taste in films, shared.',
    description: 'Rate today\'s films in a few swipes, keep a film diary and a watchlist, and find the people whose taste in films matches yours.',
    features: [
      'A daily set of films to rate in seconds',
      'The People\'s Chart: what members love, by collection',
      'A film diary with dates, half-star ratings and notes',
      'A watchlist for everything you mean to see',
      'Compare taste with friends and see how closely you match',
    ],
    color: '#d4ff3f',
    onColor: '#0a0a0d',
    screens: [
      { src: 'apps/reelmates-1.webp', alt: 'ReelMates: today\'s film to rate' },
      { src: 'apps/reelmates-2.webp', alt: 'ReelMates: Explore and the People\'s Chart' },
      { src: 'apps/reelmates-3.webp', alt: 'ReelMates: film friends and taste match' },
    ],
  },
];
