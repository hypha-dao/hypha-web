export type MemberHomePhase =
  | 'loading'
  | 'signed-out'
  | 'signup'
  | 'profile-unavailable'
  | 'home-unavailable'
  | 'ready';

export type MemberHomeRecord = 'missing' | 'none' | 'present';

/**
 * Header auth is Privy's `authenticated` flag (wallet can show immediately).
 * Home must use the same flag, then `/me`:
 * - 404 (`person: none`) is the welcome signup flow
 * - 500 (`meError`) stays signed in and must not look like "no profile"
 * - a loaded person stays on home even if intelligence fails
 */
export function resolveMemberHomePhase(input: {
  authLoading: boolean;
  jwtLoading: boolean;
  authenticated: boolean;
  personLoading: boolean;
  person: MemberHomeRecord;
  meError: boolean;
  homeLoading: boolean;
  home: MemberHomeRecord;
  homeError: boolean;
}): MemberHomePhase {
  if (input.authLoading || input.jwtLoading) return 'loading';
  if (!input.authenticated) return 'signed-out';
  // A loaded person (including one kept while /me retries) is connected.
  // A 500 with no person must not fall through to signup or sign-in.
  if (input.meError && input.person !== 'present') return 'profile-unavailable';
  if (input.personLoading || input.person === 'missing') return 'loading';
  if (input.person === 'none') return 'signup';
  if (input.homeError || input.home === 'none') return 'home-unavailable';
  if (input.homeLoading || input.home === 'missing') return 'loading';
  return 'ready';
}
