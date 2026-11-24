/** Voice note transcripts (pure, unit-tested): the words, and how they sit in a moment's text. */

/** What was said so far: finished phrases plus the one still being heard. */
export function transcriptFrom(finals: readonly string[], interim = '') {
  return [...finals, interim].map(t => t.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

export const TRANSCRIPT_MARK = '🎙 ';

/**
 * A moment's text with its voice notes written out: what you typed, then each transcript on its own
 * line starting with 🎙. With nothing typed and nothing heard it falls back to "🎙 Voice note".
 */
export function bodyWithTranscripts(typed: string, transcripts: readonly (string | undefined)[]) {
  const said = transcripts.map(t => (t ?? '').trim()).filter(Boolean).map(t => `${TRANSCRIPT_MARK}${t}`);
  const text = typed.trim();
  if (!said.length) return text || null;
  return [text, ...said].filter(Boolean).join('\n');
}

/** Splits a moment's text into what was typed and the written-out voice lines (for display). */
export function splitTranscripts(body: string) {
  const lines = body.split('\n');
  return {
    typed: lines.filter(l => !l.startsWith(TRANSCRIPT_MARK)).join('\n').trim(),
    said: lines.filter(l => l.startsWith(TRANSCRIPT_MARK)).map(l => l.slice(TRANSCRIPT_MARK.length).trim()).filter(Boolean),
  };
}
