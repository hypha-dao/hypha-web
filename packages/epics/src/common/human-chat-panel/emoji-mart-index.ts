import type { EmojiMartData } from '@emoji-mart/data';

export type EmojiIndexEntry = { id: string; native: string };

let indexPromise: Promise<{
  byId: Map<string, string>;
  all: EmojiIndexEntry[];
}> | null = null;

/**
 * Lazy-load emoji-mart data (large JSON) once; used for :shortcode autocomplete.
 */
export function loadEmojiSearchIndex(): Promise<{
  byId: Map<string, string>;
  all: EmojiIndexEntry[];
}> {
  if (!indexPromise) {
    indexPromise = (async () => {
      const mod = await import('@emoji-mart/data');
      const data = mod.default as EmojiMartData;
      const byId = new Map<string, string>();
      const all: EmojiIndexEntry[] = [];
      for (const [id, emoji] of Object.entries(data.emojis)) {
        const native = emoji.skins[0]?.native;
        if (!native) continue;
        byId.set(id, native);
        all.push({ id, native });
      }
      return { byId, all };
    })();
  }
  return indexPromise;
}

const MAX_SUGGESTIONS = 24;

export function filterEmojiShortcodes(
  all: EmojiIndexEntry[],
  query: string,
): EmojiIndexEntry[] {
  const q = query.toLowerCase();
  if (!q) {
    return all.slice(0, MAX_SUGGESTIONS);
  }
  const starts: EmojiIndexEntry[] = [];
  const contains: EmojiIndexEntry[] = [];
  for (const e of all) {
    if (e.id.startsWith(q)) {
      starts.push(e);
    } else if (e.id.includes(q)) {
      contains.push(e);
    }
    if (starts.length + contains.length >= MAX_SUGGESTIONS * 2) break;
  }
  return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
}

/**
 * Parse active `:shortcode` fragment before cursor (Discord-style).
 */
export function getActiveColonToken(
  value: string,
  cursor: number,
): { start: number; query: string } | null {
  const before = value.slice(0, cursor);
  const colonIdx = before.lastIndexOf(':');
  if (colonIdx === -1) return null;
  const afterColon = before.slice(colonIdx + 1);
  if (afterColon.includes('\n')) return null;
  if (!/^[\w_]*$/.test(afterColon)) return null;
  return { start: colonIdx, query: afterColon };
}
