/**
 * Shapes whatever is typed into a 24-hour time: digits only, the colon added for you, impossible
 * hours and minutes refused. "630" → "06:30", "1745" → "17:45", "abc" → "", "99" → "9".
 */
export function typeTime(raw: string): string {
  let d = raw.replace(/\D/g, '').slice(0, 4);
  // A first digit of 3-9 can only be an hour like 7 → 07.
  if (d.length >= 1 && Number(d[0]) > 2) d = ('0' + d).slice(0, 4);
  if (d.length >= 2 && Number(d.slice(0, 2)) > 23) d = d.slice(0, 1);
  if (d.length >= 3 && Number(d[2]) > 5) d = d.slice(0, 2);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
}
