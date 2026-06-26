'use client';

import type { StoredOnboardingChatMessage } from './ai-onboarding-context';

const STORAGE_PREFIX = 'hypha:space-ai-chat:';

function storageKey(spaceSlug: string): string {
  return `${STORAGE_PREFIX}${spaceSlug.trim()}`;
}

export function saveSpaceAiChatMessages(
  spaceSlug: string,
  messages: StoredOnboardingChatMessage[],
): void {
  if (typeof window === 'undefined') return;
  const slug = spaceSlug.trim();
  if (!slug) return;
  try {
    window.sessionStorage.setItem(storageKey(slug), JSON.stringify(messages));
  } catch {
    // Ignore quota / private mode failures.
  }
}

export function readSpaceAiChatMessages(
  spaceSlug: string,
): StoredOnboardingChatMessage[] | undefined {
  if (typeof window === 'undefined') return undefined;
  const slug = spaceSlug.trim();
  if (!slug) return undefined;
  try {
    const raw = window.sessionStorage.getItem(storageKey(slug));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter(
      (entry): entry is StoredOnboardingChatMessage =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as StoredOnboardingChatMessage).id === 'string' &&
        typeof (entry as StoredOnboardingChatMessage).role === 'string',
    );
  } catch {
    return undefined;
  }
}

export function clearSpaceAiChatMessages(spaceSlug: string): void {
  if (typeof window === 'undefined') return;
  const slug = spaceSlug.trim();
  if (!slug) return;
  window.sessionStorage.removeItem(storageKey(slug));
}
