// A small first line of defence for the stores' "filter objectionable content" rule.
// Reports and blocks do the real work; extend the list with CONTENT_BLOCKLIST (comma-separated).
const BASE = ['nigger', 'faggot', 'kill yourself', 'kys', 'rape you', 'child porn'];

function words(): string[] {
  const extra = (process.env.CONTENT_BLOCKLIST || '').split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
  return [...BASE, ...extra];
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[0@]/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/[4]/g, 'a').replace(/[5$]/g, 's')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when the text contains a blocked word or phrase as whole words. */
export function containsBlockedContent(text: string | null | undefined): boolean {
  if (!text) return false;
  const haystack = ` ${normalize(text)} `;
  return words().some(w => haystack.includes(` ${normalize(w)} `));
}
