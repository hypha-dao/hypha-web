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
  fallback: OnboardingDiscoveryMode = 'chat',
): OnboardingDiscoveryMode {
  const slug = normalizeSpaceSlug(spaceSlug);
  if (!slug || typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${slug}`);
    return isOnboardingDiscoveryMode(raw) ? raw : fallback;
  } catch {
    return fallback;
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

const VOICE_MIC_KEY_PREFIX = 'hypha:ai-panel-voice-mic:v1:';
const VOICE_SOUND_KEY_PREFIX = 'hypha:ai-panel-voice-sound:v1:';

/** Conversation starts on. A stored "off" is the only way it stays quiet. */
export function readSpaceVoiceOn(
  spaceSlug: string | undefined,
  kind: 'mic' | 'sound',
): boolean {
  const slug = normalizeSpaceSlug(spaceSlug);
  if (!slug || typeof window === 'undefined') return true;
  try {
    const prefix =
      kind === 'mic' ? VOICE_MIC_KEY_PREFIX : VOICE_SOUND_KEY_PREFIX;
    return window.localStorage.getItem(`${prefix}${slug}`) !== 'off';
  } catch {
    return true;
  }
}

export function writeSpaceVoiceOn(
  spaceSlug: string | undefined,
  kind: 'mic' | 'sound',
  on: boolean,
): void {
  const slug = normalizeSpaceSlug(spaceSlug);
  if (!slug || typeof window === 'undefined') return;
  try {
    const prefix =
      kind === 'mic' ? VOICE_MIC_KEY_PREFIX : VOICE_SOUND_KEY_PREFIX;
    window.localStorage.setItem(`${prefix}${slug}`, on ? 'on' : 'off');
  } catch {
    // The choice still applies for this visit.
  }
}
