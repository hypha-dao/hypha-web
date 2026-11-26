export const ORIENTATION_COOKIE = 'hypha_orientation';

export type KnownOrientation = 'member' | 'builder' | 'investor';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function readOrientationCookie(
  value: string | null | undefined,
): KnownOrientation | null {
  if (value === 'member' || value === 'builder' || value === 'investor') {
    return value;
  }
  return null;
}

/**
 * While the profile request is in flight, a previous visit can already say
 * who this browser belongs to. Once the profile arrives it wins, so a stale
 * cookie cannot keep the wrong shell.
 */
export function resolveMemberExperience(input: {
  liveSettled: boolean;
  liveOrientation: string | null | undefined;
  remembered: KnownOrientation | null;
}): {
  orientation: KnownOrientation | null;
  isMember: boolean;
  settled: boolean;
} {
  if (!input.liveSettled) {
    return {
      orientation: input.remembered,
      isMember: input.remembered === 'member',
      settled: input.remembered != null,
    };
  }
  const orientation = readOrientationCookie(input.liveOrientation ?? null);
  return {
    orientation,
    isMember: orientation === 'member',
    settled: true,
  };
}

export function writeOrientationCookie(value: string | null | undefined) {
  if (typeof document === 'undefined') return;
  const orientation = readOrientationCookie(value ?? null);
  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:'
      ? '; Secure'
      : '';
  const maxAge = orientation ? ONE_YEAR_SECONDS : 0;
  document.cookie = `${ORIENTATION_COOKIE}=${
    orientation ?? ''
  }; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}
