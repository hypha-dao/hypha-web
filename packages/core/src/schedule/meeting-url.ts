import { buildScheduledCallJoinPath } from './matrix-link';
import type { ScheduledItem } from './types';

export function isJoinableScheduledItem(item: {
  type: string;
  matrixAutoLink?: boolean;
  meetingUrl?: string | null;
}): boolean {
  if (item.type !== 'call' && item.type !== 'meeting') return false;
  return Boolean(item.matrixAutoLink || item.meetingUrl?.trim());
}

export function buildScheduledItemJoinPath(
  item: Pick<ScheduledItem, 'type' | 'matrixAutoLink' | 'meetingUrl'>,
  lang: string,
  spaceSlug: string,
): string | null {
  if (!isJoinableScheduledItem(item)) return null;
  if (item.matrixAutoLink) {
    return buildScheduledCallJoinPath(lang, spaceSlug);
  }
  const meetingUrl = item.meetingUrl?.trim();
  if (!meetingUrl) return null;
  if (meetingUrl.startsWith('/')) {
    return meetingUrl;
  }
  try {
    const parsed = new URL(meetingUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

export function sanitizeJoinHref(
  url: string | null | undefined,
): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//')) return null;
    if (/[\u0000-\u001F\u007F<>"]/.test(trimmed)) return null;
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

export function resolveScheduledItemJoinUrl(
  item: Pick<ScheduledItem, 'type' | 'matrixAutoLink' | 'meetingUrl'>,
  lang: string,
  spaceSlug: string,
  origin?: string,
): string | null {
  const pathOrUrl = buildScheduledItemJoinPath(item, lang, spaceSlug);
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return sanitizeJoinHref(pathOrUrl);
  }
  const base = origin?.trim() || '';
  if (!base) return sanitizeJoinHref(pathOrUrl);
  try {
    return sanitizeJoinHref(new URL(pathOrUrl, base).href);
  } catch {
    return sanitizeJoinHref(pathOrUrl);
  }
}
