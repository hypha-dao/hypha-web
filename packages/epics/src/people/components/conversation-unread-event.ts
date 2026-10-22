export const CONVERSATION_UNREAD_EVENT = 'hypha:conversation-unread';

/** Ask every unread badge to recompute now, including the desktop nav. */
export function notifyConversationUnreadChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CONVERSATION_UNREAD_EVENT));
}
