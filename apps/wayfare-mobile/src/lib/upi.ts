/** UPI payment links for Settle up (pure, unit-tested). Only for amounts in rupees. */

/** A UPI ID looks like name@bank (letters, digits, dot, dash, underscore before the @). */
export function isValidUpiId(v: string) {
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/.test(v.trim());
}

export function cleanUpiId(v: string) {
  return v.trim().toLowerCase();
}

/**
 * upi://pay link every UPI app understands (GPay, PhonePe, Paytm, BHIM…): payee, name, amount in
 * rupees with paise, and a short note. The app opens with these filled in; the person confirms.
 */
export function upiPayLink(p: { upiId: string; name: string; amount: number; note: string }) {
  const q = [
    ['pa', cleanUpiId(p.upiId)],
    ['pn', p.name.trim().slice(0, 40)],
    ['am', (Math.round(p.amount * 100) / 100).toFixed(2)],
    ['cu', 'INR'],
    ['tn', p.note.trim().slice(0, 50)],
  ];
  return `upi://pay?${q.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

/** The message "Request" shares: who, how much, for which journey, and how to pay. */
export function upiRequestMessage(p: { to: string; amount: string; trip: string; myUpiId: string; link: string }) {
  return `Hi ${p.to}, your share for ${p.trip} is ${p.amount}. Pay me on UPI: ${p.link}\n(UPI ID: ${cleanUpiId(p.myUpiId)})`;
}

/** Key for remembering a person's UPI ID on this phone ("me" for your own). */
export function upiKey(name: string) {
  return name.trim().toLowerCase();
}
