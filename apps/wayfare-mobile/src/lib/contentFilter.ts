/**
 * Lightweight on-device screen for community text (App Store 1.2 asks for a filter in
 * addition to reporting + blocking). It catches the obvious cases before anything is
 * posted; server-side reports and auto-hide handle the rest.
 */

// Deliberately short: unambiguous slurs/abuse plus common scam phrasing, stored as stems so
// variants ("…ing", plurals) match. Words with innocent uses ("retardant") or that travellers
// need for safety warnings are left to reports and blocking instead.
const BLOCKED_STEMS = [
  'fuck',
  'motherfuck',
  'cunt',
  'nigger',
  'nigga',
  'faggot',
  'whore',
  'slut',
  'madarchod',
  'behenchod',
  'bhenchod',
  'chutiya',
];

const SCAM_PATTERNS = [
  /\b(send|pay)\b.{0,20}\b(advance|deposit|upfront)\b/i,
  /\bwhats\s?app\b.{0,20}\b(earn|investment|crypto)\b/i,
  /\b(guaranteed|double)\b.{0,15}\b(returns?|profit)\b/i,
];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' };

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[013457@$!]/g, c => LEET[c] ?? c)
    .replace(/(.)\1{2,}/g, '$1$1');
}

export type ScreenResult = { ok: true } | { ok: false; reason: string };

/** Joins spelled-out letter runs ("f.u.c.k", "f u c k") without merging normal words. */
function spelledOut(n: string) {
  const runs = n.match(/(?:^|[^a-z])((?:[a-z][^a-z0-9]{1,2}){3,}[a-z])(?![a-z])/g) ?? [];
  return runs.map(r => r.replace(/[^a-z]/g, ''));
}

export function screenText(text: string): ScreenResult {
  const raw = text ?? '';
  const n = normalize(raw);
  const runs = spelledOut(n);
  for (const stem of BLOCKED_STEMS) {
    const wordHit = new RegExp(`(^|[^a-z])${stem}`, 'i').test(n);
    if (wordHit || runs.some(r => r.startsWith(stem))) {
      return { ok: false, reason: 'Please keep it kind — that language is not allowed on Wayfare.' };
    }
  }
  if (SCAM_PATTERNS.some(p => p.test(raw))) {
    return { ok: false, reason: 'This looks like a payment or investment request. Wayfare never asks travellers to pay upfront.' };
  }
  const links = raw.match(/https?:\/\/\S+/gi) ?? [];
  if (links.length > 3) return { ok: false, reason: 'Too many links — share the essentials only.' };
  return { ok: true };
}
