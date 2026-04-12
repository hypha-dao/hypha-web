/**
 * Persist which emoji reactions the current user sends most often (per browser),
 * to populate Discord-style quick-react slots on message hover.
 */
const STORAGE_KEY_PREFIX = 'hypha-chat-quick-reactions-v1';
const RECENT_EMOJI_MENU_KEY_PREFIX = 'hypha-chat-recent-emojis-v1';
/** Pre-user-id keys (migrate once into scoped keys). */
const LEGACY_STORAGE_KEY = 'hypha-chat-quick-reactions-v1';
const LEGACY_RECENT_EMOJI_MENU_KEY = 'hypha-chat-recent-emojis-v1';

function storageUserSegment(userId: string | null | undefined): string {
  const id = userId?.trim();
  return id && id.length > 0 ? id : 'anon';
}

function quickReactionsStorageKey(userId: string | null | undefined): string {
  return `${STORAGE_KEY_PREFIX}:${storageUserSegment(userId)}`;
}

function recentEmojiMenuStorageKey(userId: string | null | undefined): string {
  return `${RECENT_EMOJI_MENU_KEY_PREFIX}:${storageUserSegment(userId)}`;
}

function migrateLegacyEmojiStorage(userId: string | null | undefined): void {
  try {
    const nextCounts = quickReactionsStorageKey(userId);
    const nextRecent = recentEmojiMenuStorageKey(userId);
    if (
      !localStorage.getItem(nextCounts) &&
      localStorage.getItem(LEGACY_STORAGE_KEY)
    ) {
      localStorage.setItem(
        nextCounts,
        localStorage.getItem(LEGACY_STORAGE_KEY)!,
      );
    }
    if (
      !localStorage.getItem(nextRecent) &&
      localStorage.getItem(LEGACY_RECENT_EMOJI_MENU_KEY)
    ) {
      localStorage.setItem(
        nextRecent,
        localStorage.getItem(LEGACY_RECENT_EMOJI_MENU_KEY)!,
      );
    }
  } catch {
    // ignore
  }
}

/** Fallback when the user has not reacted yet (common chat defaults). */
export const DEFAULT_QUICK_REACTION_EMOJIS = ['👍', '🎵', '🙏', '✅'] as const;

function readRecentEmojiList(userId: string | null | undefined): string[] {
  migrateLegacyEmojiStorage(userId);
  try {
    const raw = localStorage.getItem(recentEmojiMenuStorageKey(userId));
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

function writeRecentEmojiList(
  list: string[],
  userId: string | null | undefined,
): void {
  try {
    localStorage.setItem(
      recentEmojiMenuStorageKey(userId),
      JSON.stringify(list),
    );
  } catch {
    // ignore
  }
}

/**
 * Remember emoji for the overflow “recent” strip (reactions + menu picks).
 */
export function recordRecentMenuEmoji(
  emoji: string,
  userId?: string | null,
): void {
  const key = emoji.trim();
  if (!key) return;
  const prev = readRecentEmojiList(userId);
  const next = [key, ...prev.filter((e) => e !== key)].slice(0, 24);
  writeRecentEmojiList(next, userId);
}

/**
 * Most recently used emoji for the message overflow menu (newest first).
 * Pads with {@link DEFAULT_QUICK_REACTION_EMOJIS} when needed.
 */
export function getRecentMenuEmojis(
  limit = 4,
  userId?: string | null,
): string[] {
  const recent = readRecentEmojiList(userId);
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

function readCounts(userId: string | null | undefined): Record<string, number> {
  migrateLegacyEmojiStorage(userId);
  try {
    const raw = localStorage.getItem(quickReactionsStorageKey(userId));
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

function writeCounts(
  counts: Record<string, number>,
  userId: string | null | undefined,
): void {
  try {
    localStorage.setItem(
      quickReactionsStorageKey(userId),
      JSON.stringify(counts),
    );
  } catch {
    // ignore quota / private mode
  }
}

/** Increment usage for one emoji key (typically after a successful reaction send). */
export function recordUserReactionEmojiUse(
  emoji: string,
  userId?: string | null,
): void {
  const key = emoji.trim();
  if (!key) return;
  const counts = readCounts(userId);
  counts[key] = (counts[key] ?? 0) + 1;
  writeCounts(counts, userId);
  recordRecentMenuEmoji(key, userId);
}

/**
 * Top emoji by frequency for this user, oldest tie-breaker first.
 * Pads with {@link DEFAULT_QUICK_REACTION_EMOJIS} when fewer than `limit` exist.
 */
export function getTopQuickReactionEmojis(
  limit = DEFAULT_QUICK_REACTION_EMOJIS.length,
  userId?: string | null,
): string[] {
  const counts = readCounts(userId);
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
