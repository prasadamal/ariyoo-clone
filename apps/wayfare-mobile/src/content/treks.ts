export type TrekGuide = {
  id: string;
  name: string;
  region: string;
  difficulty: string;
  bestSeason: string;
  permits: string;
  acclimatisation: string;
  connectivity: string;
  transport: string;
};

export const TREK_GUIDES: TrekGuide[] = [
  {
    id: 'kedarkantha',
    name: 'Kedarkantha',
    region: 'Uttarakhand',
    difficulty: 'Moderate',
    bestSeason: 'Dec–Apr (snow), Apr–Jun',
    permits: 'Forest permit via local operator; carry ID.',
    acclimatisation: 'Base ~6,400 ft, summit ~12,500 ft. One rest day recommended.',
    connectivity: 'Weak signal after Sankri. Offline maps essential.',
    transport: 'Dehradun → Sankri by shared taxi (~8–10 hrs).',
  },
  {
    id: 'hampta-pass',
    name: 'Hampta Pass',
    region: 'Himachal Pradesh',
    difficulty: 'Moderate–challenging',
    bestSeason: 'Jun–Sep',
    permits: 'Local forest fees; guide often required.',
    acclimatisation: 'Crosses ~14,000 ft. Hydrate and pace the pass day.',
    connectivity: 'Spotty in Manali; none on trail.',
    transport: 'Manali base; operator arranges Jobra/Chika transfer.',
  },
  {
    id: 'triund',
    name: 'Triund',
    region: 'Himachal Pradesh',
    difficulty: 'Easy–moderate',
    bestSeason: 'Mar–Jun, Sep–Nov',
    permits: 'Forest entry fee at Galu Devi.',
    acclimatisation: 'Short trek; good first Himalayan overnight.',
    connectivity: 'Works until McLeod Ganj; limited on ridge.',
    transport: 'Dharamshala → McLeod Ganj → trek start.',
  },
];

export const PACKING_TEMPLATES: Record<string, string[]> = {
  trek: [
    'Trekking shoes (broken in)',
    'Layered clothing + rain shell',
    'Headlamp + spare batteries',
    'Water bottles / hydration',
    'First aid + personal meds',
    'Sunscreen & lip balm',
    'Snacks & electrolytes',
    'ID & cash in waterproof pouch',
  ],
  road: ['Driver documents', 'Spare tyre kit', 'Offline maps', 'Snacks & water', 'Power bank'],
  city: ['Comfortable shoes', 'Day pack', 'Universal adapter', 'Offline city map'],
};
