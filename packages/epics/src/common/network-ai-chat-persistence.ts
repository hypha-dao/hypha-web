'use client';

import type { StoredOnboardingChatMessage } from './ai-onboarding-context';

/** Shared session key for Network AI across home / messages / wallet / my-spaces / network. */
export const NETWORK_AI_CHAT_ID = 'network-ai';

const STORAGE_KEY = 'hypha:network-ai-chat';

export function saveNetworkAiChatMessages(
  messages: StoredOnboardingChatMessage[],
): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Ignore quota / private mode failures.
  }
}

export function readNetworkAiChatMessages():
  | StoredOnboardingChatMessage[]
  | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
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

export function clearNetworkAiChatMessages(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
