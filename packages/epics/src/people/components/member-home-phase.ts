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

/**
 * Show words as soon as they stream. A card turn may still be waiting on
 * `show_member_home_item` — do not hold the spoken line behind that tool,
 * or the bubble feels several seconds late. The card lands above when ready.
 * Text-only turns show as soon as they have words.
 */
export function memberHomeReplyReady(input: {
  text: string;
  hasCard: boolean;
  streaming: boolean;
  expectsCard?: boolean;
}): boolean {
  void input.expectsCard;
  void input.streaming;
  if (input.hasCard) return true;
  if (input.text.trim().length > 0) return true;
  return false;
}

/** Name only when /me is the signed-in member (`person.sub === memberId`). */
export function resolveMemberHomeGreetingName(input: {
  personName?: string | null;
  personNickname?: string | null;
  personIsCurrentMember: boolean;
}): string | null {
  if (!input.personIsCurrentMember) return null;
  return input.personName?.trim() || input.personNickname?.trim() || null;
}
