/**
 * `chat.message` / `chat.mention` — decision-layer wiring (#2470 steps 4/5). Consumes
 * `ChatNotificationEvent` produced by `#2483`'s AS receiver (`ingest/matrix-as/ingest-message.ts`)
 * via `dispatch()`. Recipient resolution/content re-derives `notify-chat-mention.ts`'s prior
 * logic for mentions (now scoped to the room's own space rather than "any shared space" — the
 * event already carries a DB-resolved room→space mapping, a stronger boundary); `chat.message`
 * (all-messages, D1) has no prior client-fired implementation to preserve — new content, push
 * only (D15).
 */
import { dispatch } from '../../core/dispatch';
import { registerEventHandlers } from '../../core/registry';
import type { ChatNotificationEvent } from '../../core/types';
import type { NotificationDispatch } from '../../ingest/matrix-as/types';
import { buildChatContent } from './content';
import { resolveChatRecipients } from './resolver';

export { buildChatDeepLink } from './deep-link';
export { buildChatContent } from './content';
export { resolveChatRecipients } from './resolver';

/**
 * Adapts the generic `dispatch()` (returns `DispatchResult | null`) to the narrower
 * `NotificationDispatch` shape (`Promise<void>`) the AS receiver / reconciler are built against
 * (`ingest/matrix-as/types.ts`) — wire this in place of `loggingDispatch`.
 */
export const chatNotificationDispatch: NotificationDispatch = async (
  event: ChatNotificationEvent,
) => {
  await dispatch(event);
};

registerEventHandlers('chat.message', {
  resolver: resolveChatRecipients,
  contentBuilder: buildChatContent,
});

registerEventHandlers('chat.mention', {
  resolver: resolveChatRecipients,
  contentBuilder: buildChatContent,
});
