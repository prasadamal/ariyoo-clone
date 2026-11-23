/**
 * Light formatting for diary pages, stored inside the plain text so it syncs like any other moment:
 *   # Heading          ## Subheading          (at the start of a line)
 *   **bold**           __underline__          {orange}coloured words{/}
 * The diary renders it; everywhere else uses stripRich() so the marks never show.
 */
export const RICH_COLORS = {
  purple: '#6a01a3',
  orange: '#e07b10',
  red: '#d32f2f',
  green: '#2e7d32',
  blue: '#1565c0',
} as const;
export type RichColor = keyof typeof RICH_COLORS;

export type RichSpan = { text: string; marker: boolean; bold: boolean; underline: boolean; color: RichColor | null };
export type RichLine = { kind: 'h1' | 'h2' | 'p'; prefix: string; spans: RichSpan[] };

const TOKEN = /(\*\*|__|\{(?:purple|orange|red|green|blue)\}|\{\/\})/g;

export function parseRich(text: string): RichLine[] {
  return text.split('\n').map(line => {
    const kind: RichLine['kind'] = line.startsWith('## ') ? 'h2' : line.startsWith('# ') ? 'h1' : 'p';
    const prefix = kind === 'h2' ? '## ' : kind === 'h1' ? '# ' : '';
    const body = line.slice(prefix.length);
    const spans: RichSpan[] = [];
    let bold = false;
    let underline = false;
    let color: RichColor | null = null;
    let last = 0;
    const push = (t: string, marker: boolean) => {
      if (t) spans.push({ text: t, marker, bold, underline, color });
    };
    for (const m of body.matchAll(TOKEN)) {
      push(body.slice(last, m.index), false);
      const tok = m[0];
      if (tok === '**') { push(tok, true); bold = !bold; }
      else if (tok === '__') { push(tok, true); underline = !underline; }
      else if (tok === '{/}') { push(tok, true); color = null; }
      else { color = tok.slice(1, -1) as RichColor; push(tok, true); }
      last = (m.index ?? 0) + tok.length;
    }
    push(body.slice(last), false);
    return { kind, prefix, spans };
  });
}

/** The words without any formatting marks (for cards, exports and previews). */
export function stripRich(text: string): string {
  return parseRich(text)
    .map(l => l.spans.filter(s => !s.marker).map(s => s.text).join(''))
    .join('\n');
}

export type Selection = { start: number; end: number };

/** Wraps the selected words in open/close marks, or removes them if they are already there. */
export function toggleWrap(text: string, sel: Selection, open: string, close: string): { text: string; selection: Selection } | null {
  const start = Math.min(sel.start, sel.end);
  const end = Math.max(sel.start, sel.end);
  if (start === end) return null;
  if (text.slice(start - open.length, start) === open && text.slice(end, end + close.length) === close) {
    return {
      text: text.slice(0, start - open.length) + text.slice(start, end) + text.slice(end + close.length),
      selection: { start: start - open.length, end: end - open.length },
    };
  }
  return { text: text.slice(0, start) + open + text.slice(start, end) + close + text.slice(end), selection: { start: start + open.length, end: end + open.length } };
}

/** Makes the line under the cursor a heading / subheading, or back to normal text if it already is. */
export function toggleLine(text: string, cursor: number, kind: 'h1' | 'h2'): { text: string; cursor: number } {
  const lineStart = text.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
  const rest = text.slice(lineStart);
  const current = rest.startsWith('## ') ? '## ' : rest.startsWith('# ') ? '# ' : '';
  const wanted = kind === 'h1' ? '# ' : '## ';
  const next = current === wanted ? '' : wanted;
  return { text: text.slice(0, lineStart) + next + rest.slice(current.length), cursor: Math.max(lineStart, cursor - current.length + next.length) };
}
