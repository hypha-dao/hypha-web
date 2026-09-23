import { getAbsoluteAppUrl } from '@hypha-platform/core/server';

/**
 * Same shape as `packages/epics/src/common/human-chat-panel/human-chat-message-link.ts`'s
 * `buildHyphaChatMentionDeepLinkUrl` (the canonical client-side deep link for mention emails) —
 * re-implemented here rather than imported, since `packages/notifications` doesn't depend on
 * `packages/epics` and the logic is a few lines of pure string-building. Defaults to `en`, same
 * as `dispatch-scheduled-item-invitation.ts`'s server-fired path — a server event has no active
 * UI locale to read.
 */
export function buildChatDeepLink({
  spaceSlug,
  messageId,
  signalSlug,
}: {
  spaceSlug: string;
  messageId: string;
  signalSlug?: string | null;
}): string {
  const params = new URLSearchParams();
  const signal = signalSlug?.trim();
  if (signal) params.set('signal', signal);
  params.set('msg', messageId);
  return getAbsoluteAppUrl(`/en/dho/${spaceSlug}?${params.toString()}`);
}
