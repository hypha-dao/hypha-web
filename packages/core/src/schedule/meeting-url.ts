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
  return meetingUrl;
}

export function resolveScheduledItemJoinUrl(
  item: Pick<ScheduledItem, 'type' | 'matrixAutoLink' | 'meetingUrl'>,
  lang: string,
  spaceSlug: string,
  origin?: string,
): string | null {
  const pathOrUrl = buildScheduledItemJoinPath(item, lang, spaceSlug);
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = origin?.trim() || '';
  if (!base) return pathOrUrl;
  try {
    return new URL(pathOrUrl, base).href;
  } catch {
    return pathOrUrl;
  }
}
