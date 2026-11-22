/** @mentions in moment text: "@arif" (3–24 of a–z, 0–9, . and _, the same rule as usernames). */
const MENTION = /(^|[^a-z0-9_.@])@([a-z0-9_.]{3,24})(?![a-z0-9_])/gi;

export type TextPart = { text: string; mention?: string };

/** Split text into plain parts and @mention parts (mention holds the lower-cased username). */
export function splitMentions(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION)) {
    const start = (m.index ?? 0) + m[1].length;
    if (start > last) parts.push({ text: text.slice(last, start) });
    const handle = m[2].replace(/\.+$/, '');
    parts.push({ text: `@${handle}`, mention: handle.toLowerCase() });
    last = start + 1 + handle.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** Distinct usernames mentioned in a text. */
export function mentionedUsernames(text: string): string[] {
  return [...new Set(splitMentions(text).filter(p => p.mention).map(p => p.mention as string))];
}

/** The @word being typed at the end of the text, if any ("see you @an" → "an", "@" → ""). */
export function typingMention(text: string): string | null {
  const m = /(?:^|\s)@([a-z0-9_.]{0,24})$/i.exec(text);
  return m ? m[1].toLowerCase() : null;
}
