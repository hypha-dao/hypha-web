export const MEMBER_HOME_ASK_EVENT = 'hypha-member-home-ask';

/** Sends a line into the home conversation from a card outside the thread. */
export function requestMemberHomeAsk(text: string) {
  const trimmed = text.trim();
  if (!trimmed || typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(MEMBER_HOME_ASK_EVENT, { detail: { text: trimmed } }),
  );
}
