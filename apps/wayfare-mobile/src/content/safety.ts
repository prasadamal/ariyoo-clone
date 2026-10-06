/** Safety reference content. General guidance only — not medical advice. */

export type EmergencyNumbers = {
  country: string;
  general: string;
  police?: string;
  ambulance?: string;
  tourist?: string;
  women?: string;
};

export const EMERGENCY_NUMBERS: Record<string, EmergencyNumbers> = {
  IN: { country: 'India', general: '112', police: '100', ambulance: '108', tourist: '1363', women: '1091' },
  NP: { country: 'Nepal', general: '100', police: '100', ambulance: '102', tourist: '1144' },
  BT: { country: 'Bhutan', general: '112', police: '113', ambulance: '112' },
  LK: { country: 'Sri Lanka', general: '119', police: '119', ambulance: '1990', tourist: '1912' },
  ID: { country: 'Indonesia', general: '112', police: '110', ambulance: '118' },
  TH: { country: 'Thailand', general: '191', police: '191', ambulance: '1669', tourist: '1155' },
  VN: { country: 'Vietnam', general: '113', police: '113', ambulance: '115' },
};

/** 112 reaches emergency services from most mobile networks worldwide. */
export const FALLBACK_EMERGENCY: EmergencyNumbers = { country: 'Anywhere', general: '112' };

export function emergencyNumbersFor(countryCode: string | null | undefined) {
  return (countryCode && EMERGENCY_NUMBERS[countryCode.toUpperCase()]) || FALLBACK_EMERGENCY;
}

export const ALTITUDE_GUIDE = {
  intro:
    'Altitude illness can affect anyone above ~2,500 m regardless of fitness. Ascend gradually and listen to your body.',
  rules: [
    'Above 3,000 m, try not to raise your sleeping altitude by more than 300–500 m a day.',
    'Add a rest day for every 1,000 m gained or every 3–4 days.',
    'Climb high, sleep low: day hikes higher, then sleep lower.',
    'Hydrate, eat well and avoid alcohol for the first days at altitude.',
    'Never ascend with symptoms. If they get worse, go down — even 300–500 m helps.',
  ],
  ams: ['Headache plus nausea or loss of appetite', 'Fatigue or weakness', 'Dizziness', 'Poor sleep'],
  danger: [
    'Confusion, clumsiness or trouble walking in a straight line (possible HACE)',
    'Breathlessness at rest, a wet cough or blue lips (possible HAPE)',
    'Drowsiness that makes the person hard to wake',
  ],
  dangerAdvice: 'These are emergencies: descend immediately with company and seek medical help.',
};

export const TREK_CHECKLIST = [
  'Share your route, dates and turnaround time with someone at home',
  'Carry a headlamp, layers, rain shell, water and snacks — even on day hikes',
  'Download offline maps and keep a power bank',
  'Know the nearest road-head, health post and emergency number',
  'Check the weather the evening before and on the morning of your hike',
  'Start early; agree a turnaround time and keep to it',
];

export const MEETUP_SAFETY = [
  'Meet new travel buddies in busy public places first',
  'Tell a friend who you are meeting and share your live location',
  'Never send money in advance to someone you met online',
  'Keep your own copy of IDs and permits; do not hand over originals',
  'Trust your instincts — you can always leave, block and report',
];
