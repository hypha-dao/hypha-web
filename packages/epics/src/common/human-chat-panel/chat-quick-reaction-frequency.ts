/**
 * Persist which emoji reactions the current user sends most often (per browser),
 * to populate Discord-style quick-react slots on message hover.
 */
const STORAGE_KEY = 'hypha-chat-quick-reactions-v1';
const RECENT_EMOJI_MENU_KEY = 'hypha-chat-recent-emojis-v1';

/** Fallback when the user has not reacted yet (common chat defaults). */
export const DEFAULT_QUICK_REACTION_EMOJIS = ['👍', '🎵', '🙏', '✅'] as const;

function readRecentEmojiList(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_EMOJI_MENU_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is string => typeof x === 'string' && x.trim().length > 0,
    );
  } catch {
    return [];
  }
}

function writeRecentEmojiList(list: string[]): void {
  try {
    localStorage.setItem(RECENT_EMOJI_MENU_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

/**
 * Remember emoji for the overflow “recent” strip (reactions + menu picks).
 */
export function recordRecentMenuEmoji(emoji: string): void {
  const key = emoji.trim();
  if (!key) return;
  const prev = readRecentEmojiList();
  const next = [key, ...prev.filter((e) => e !== key)].slice(0, 24);
  writeRecentEmojiList(next);
}

/**
 * Most recently used emoji for the message overflow menu (newest first).
 * Pads with {@link DEFAULT_QUICK_REACTION_EMOJIS} when needed.
 */
export function getRecentMenuEmojis(limit = 4): string[] {
  const recent = readRecentEmojiList();
  const out: string[] = [];
  for (const e of recent) {
    if (out.length >= limit) break;
    if (!out.includes(e)) out.push(e);
  }
  for (const e of DEFAULT_QUICK_REACTION_EMOJIS) {
    if (out.length >= limit) break;
    if (!out.includes(e)) out.push(e);
  }
  return out.slice(0, limit);
}

function readCounts(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeCounts(counts: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // ignore quota / private mode
  }
}

/** Increment usage for one emoji key (typically after a successful reaction send). */
export function recordUserReactionEmojiUse(emoji: string): void {
  const key = emoji.trim();
  if (!key) return;
  const counts = readCounts();
  counts[key] = (counts[key] ?? 0) + 1;
  writeCounts(counts);
  recordRecentMenuEmoji(key);
}

/**
 * Top emoji by frequency for this user, oldest tie-breaker first.
 * Pads with {@link DEFAULT_QUICK_REACTION_EMOJIS} when fewer than `limit` exist.
 */
export function getTopQuickReactionEmojis(limit = 3): string[] {
  const counts = readCounts();
  const ranked = Object.entries(counts)
    .filter(([k]) => k.length > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k]) => k);

  const out: string[] = [];
  for (const e of ranked) {
    if (out.length >= limit) break;
    if (!out.includes(e)) out.push(e);
  }
  for (const e of DEFAULT_QUICK_REACTION_EMOJIS) {
    if (out.length >= limit) break;
    if (!out.includes(e)) out.push(e);
  }
  return out.slice(0, limit);
}
