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

/** Hidden auto-greeting turns. They must not count as visible thread content. */
export function memberHomeMessageIsArrival(message: {
  metadata?: unknown;
}): boolean {
  const metadata = message.metadata;
  return (
    !!metadata &&
    typeof metadata === 'object' &&
    'homeArrival' in metadata &&
    (metadata as { homeArrival?: unknown }).homeArrival === true
  );
}

/**
 * True when the restored thread has something the member can see (a real user
 * line or assistant text). Orphan `homeArrival` users alone are not visible.
 */
export function memberHomeThreadHasVisibleContent(
  messages: ReadonlyArray<{
    role: string;
    metadata?: unknown;
    parts?: ReadonlyArray<{ type: string; text?: string }>;
    content?: string;
  }>,
): boolean {
  return messages.some((message) => {
    if (memberHomeMessageIsArrival(message)) return false;
    if (message.role === 'user') return true;
    const fromParts = (message.parts ?? [])
      .filter(
        (part): part is { type: 'text'; text: string } =>
          part.type === 'text' && typeof part.text === 'string',
      )
      .map((part) => part.text)
      .join('\n')
      .trim();
    return (fromParts || message.content?.trim() || '').length > 0;
  });
}

/**
 * Arrival skeleton only while a reply is in flight. Idle empty threads must
 * not keep the card mask up forever (remount inside the welcome window, or
 * thread items arriving after first paint).
 */
export function memberHomeShowArrivalMask(input: {
  freshStart: boolean;
  hasError: boolean;
  liveReplyPending: boolean;
}): boolean {
  if (input.freshStart || input.hasError) return false;
  return input.liveReplyPending;
}

/**
 * Whether home should auto-send the hidden arrival ask for an empty thread.
 * Empty + work waiting must greet even inside the 2h welcome window — otherwise
 * the UI sits on the arrival mask with no request in flight.
 */
export function memberHomeShouldStartArrival(input: {
  hasVisibleContent: boolean;
  talkResting: boolean;
  welcome: boolean;
  threadItemCount: number;
  lastSeen: number | null;
}): { visit: 'first_open' | 'welcome_back' } | null {
  if (input.hasVisibleContent || input.talkResting) return null;
  const visit = input.lastSeen == null ? 'first_open' : 'welcome_back';
  if (!input.welcome && input.threadItemCount === 0) return null;
  // First open with nothing waiting uses the static first-prompt, not arrival.
  if (visit === 'first_open' && input.threadItemCount === 0) return null;
  if (visit === 'welcome_back' || input.threadItemCount > 0) {
    return { visit };
  }
  return null;
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
