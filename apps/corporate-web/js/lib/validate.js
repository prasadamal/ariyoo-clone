// Form checks shared by every form. Pure functions: they take values and return messages.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_RE = /^https?:\/\/\S{3,480}$/;

export const TOPICS = ['general', 'partnership', 'investor', 'press', 'support', 'careers'];

export function isEmail(value) {
  return EMAIL.test(String(value || '').trim());
}

/** Returns { field: message } for every problem; an empty object means the form can be sent. */
export function validateContact(v) {
  const e = {};
  const name = (v.name || '').trim();
  if (!name) e.name = 'Please tell us your name.';
  else if (name.length > 120) e.name = 'Name is too long.';
  if (!isEmail(v.email)) e.email = 'Please enter a valid email address.';
  if (!TOPICS.includes(v.topic)) e.topic = 'Please choose a topic.';
  if ((v.organisation || '').trim().length > 160) e.organisation = 'Organisation is too long.';
  const msg = (v.message || '').trim();
  if (msg.length < 10) e.message = 'Please write a few sentences (at least 10 characters).';
  else if (msg.length > 4000) e.message = 'Messages can be up to 4000 characters.';
  return e;
}

export function validateApplication(v) {
  const e = {};
  if (!(v.name || '').trim()) e.name = 'Please tell us your name.';
  if (!isEmail(v.email)) e.email = 'Please enter a valid email address.';
  const link = (v.profileUrl || '').trim();
  if (link && !URL_RE.test(link)) e.profileUrl = 'Please enter a full link starting with https://';
  const msg = (v.message || '').trim();
  if (msg.length < 20) e.message = 'Please write at least 20 characters.';
  else if (msg.length > 4000) e.message = 'Please keep it under 4000 characters.';
  return e;
}
