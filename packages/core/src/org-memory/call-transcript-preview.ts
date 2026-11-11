export const CALL_TRANSCRIPT_PREVIEW_MAX_CHARS = 320;

const LEGACY_ELLIPSIS = /(?:\.\.\.|…)$/u;

/**
 * Plain-text preview for a call transcript: ends on a sentence when one lands
 * late enough, otherwise on the last whole word followed by `…`.
 * An unbroken token with no space inside the window is the one hard cut.
 */
export function previewCallTranscriptText(
  text: string,
  maxLen = CALL_TRANSCRIPT_PREVIEW_MAX_CHARS,
): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact || compact.length <= maxLen) return compact;
  let cut = compact.slice(0, maxLen);
  // `slice` counts UTF-16 units, so an emoji can be split across the cut.
  if (/[\uD800-\uDBFF]$/u.test(cut)) cut = cut.slice(0, -1);
  const sentenceStop = Math.max(
    cut.lastIndexOf('. '),
    cut.lastIndexOf('! '),
    cut.lastIndexOf('? '),
  );
  if (sentenceStop > maxLen * 0.4) return cut.slice(0, sentenceStop + 1);
  // A space exactly at `maxLen` means the cut already ends on a whole word.
  // Any earlier space wins too — only a window with no space is hard-cut.
  const wordStop = compact[maxLen] === ' ' ? maxLen : cut.lastIndexOf(' ');
  const head = (wordStop > 0 ? cut.slice(0, wordStop) : cut)
    .replace(/[\s,;:—–-]+$/u, '')
    .trim();
  return `${head}…`;
}

/**
 * Preview text for the Space Memory Calls card. A caller-supplied summary wins;
 * a stored summary that is just an auto-cut of the transcript (older ingests
 * cut mid-word and appended `...`) is regenerated from the full text.
 */
export function callTranscriptPreview({
  text,
  summary,
}: {
  text: string;
  summary?: string | null;
}): string {
  const stored = summary?.trim() ?? '';
  if (stored && !isAutoCutOfTranscript(stored, text)) return stored;
  return previewCallTranscriptText(text);
}

function isAutoCutOfTranscript(summary: string, text: string): boolean {
  if (!LEGACY_ELLIPSIS.test(summary)) return false;
  const head = summary.replace(LEGACY_ELLIPSIS, '').trim();
  if (!head) return true;
  // Short caller summaries ("We agreed…") are also prefixes. Legacy auto-cuts
  // were sliced at the preview limit, so only a head near that length qualifies.
  if (head.length < CALL_TRANSCRIPT_PREVIEW_MAX_CHARS - 5) return false;
  const compactText = text.replace(/\s+/g, ' ').trim();
  return compactText.startsWith(head.replace(/\s+/g, ' '));
}
