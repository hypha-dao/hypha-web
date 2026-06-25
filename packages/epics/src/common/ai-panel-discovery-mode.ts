'use client';

import type { OnboardingDiscoveryMode } from './onboarding-discovery-mode';
import { isOnboardingDiscoveryMode } from './onboarding-discovery-mode';

const STORAGE_KEY_PREFIX = 'hypha:ai-panel-discovery-mode:v1:';

function normalizeSpaceSlug(spaceSlug?: string): string | undefined {
  const trimmed = spaceSlug?.trim();
  return trimmed || undefined;
}

/** Per-space chat vs voice preference for the left AI panel (persists across sessions). */
export function loadSpaceDiscoveryMode(
  spaceSlug?: string,
): OnboardingDiscoveryMode {
  const slug = normalizeSpaceSlug(spaceSlug);
  if (!slug || typeof window === 'undefined') return 'chat';
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${slug}`);
    return isOnboardingDiscoveryMode(raw) ? raw : 'chat';
  } catch {
    return 'chat';
  }
}

export function saveSpaceDiscoveryMode(
  spaceSlug: string,
  mode: OnboardingDiscoveryMode,
): void {
  const slug = normalizeSpaceSlug(spaceSlug);
  if (!slug || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${slug}`, mode);
  } catch {
    // ignore quota / private mode
  }
}
