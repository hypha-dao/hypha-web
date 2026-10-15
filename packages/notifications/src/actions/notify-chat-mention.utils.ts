import { safeHref } from '../template/common/layout';

export function sanitizeMentionIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

export const getSafeMentionHref = safeHref;
