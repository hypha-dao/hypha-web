'use client';

export type OnboardingDiscoveryMode = 'chat' | 'voice_interview';

const DISCOVERY_MODES = new Set<OnboardingDiscoveryMode>([
  'chat',
  'voice_interview',
]);

export function isOnboardingDiscoveryMode(
  value: unknown,
): value is OnboardingDiscoveryMode {
  return (
    typeof value === 'string' &&
    DISCOVERY_MODES.has(value as OnboardingDiscoveryMode)
  );
}

export function parseOnboardingDiscoveryMode(
  raw: unknown,
): OnboardingDiscoveryMode | undefined {
  return isOnboardingDiscoveryMode(raw) ? raw : undefined;
}
