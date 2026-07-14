'use client';

export {
  clearOnboardingWalletSessionActive,
  isOnboardingWalletSessionActive,
  markOnboardingWalletSessionActive,
} from '@hypha-platform/authentication';

const COMPLETED_SLUGS_KEY = 'hypha:onboarding-wallet-handoff:slugs:v1';
const HANDLED_PAYLOADS_KEY = 'hypha:onboarding-wallet-handoff:payloads:v1';

function readStringSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((item): item is string => typeof item === 'string'),
    );
  } catch {
    return new Set();
  }
}

function writeStringSet(key: string, values: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify([...values]));
  } catch {
    // ignore quota / private mode
  }
}

export function isOnboardingWalletHandoffSlugComplete(slug?: string): boolean {
  const normalized = slug?.trim();
  if (!normalized) return false;
  return readStringSet(COMPLETED_SLUGS_KEY).has(normalized);
}

export function markOnboardingWalletHandoffSlugComplete(slug: string): void {
  const normalized = slug.trim();
  if (!normalized || typeof window === 'undefined') return;
  const next = readStringSet(COMPLETED_SLUGS_KEY);
  next.add(normalized);
  writeStringSet(COMPLETED_SLUGS_KEY, next);
}

export function isOnboardingWalletHandoffPayloadHandled(
  payloadKey?: string | null,
): boolean {
  const normalized = payloadKey?.trim();
  if (!normalized) return false;
  return readStringSet(HANDLED_PAYLOADS_KEY).has(normalized);
}

export function markOnboardingWalletHandoffPayloadHandled(
  payloadKey: string,
): void {
  const normalized = payloadKey.trim();
  if (!normalized || typeof window === 'undefined') return;
  const next = readStringSet(HANDLED_PAYLOADS_KEY);
  next.add(normalized);
  writeStringSet(HANDLED_PAYLOADS_KEY, next);
}
