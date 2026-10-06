/**
 * `scheduled_item.invited` — decision-layer wiring (#2470 step 2). Re-derives
 * `actions/notify-scheduled-item-invitation.ts`'s prior content logic; that file's bespoke
 * `sendEmailNotifications`/`sendPushNotifications` calls are superseded by `dispatch()` here.
 * `dispatch-scheduled-item-invitation.ts` keeps owning per-channel claim/release idempotency
 * (a different concern than dispatch()'s own pipeline) and now calls `dispatch()` per claimed
 * channel instead of `notifyScheduledItemInvitation()`.
 */
import { registerEventHandlers } from '../../core/registry';
import { buildScheduledItemInvitedContent } from './content';
import { resolveScheduledItemInvitedRecipients } from './resolver';

export { buildScheduledItemInvitedEvent } from './resolver';
export { buildScheduledItemInvitedContent } from './content';

registerEventHandlers('scheduled_item.invited', {
  resolver: resolveScheduledItemInvitedRecipients,
  contentBuilder: buildScheduledItemInvitedContent,
});
