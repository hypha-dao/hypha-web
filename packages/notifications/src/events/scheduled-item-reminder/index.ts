/**
 * `scheduled_item.reminder` — decision-layer wiring (#2549 D16). The dispatch-reminders ops route
 * keeps owning claim/release idempotency and calls `notifyScheduledItemReminder`, which now
 * builds this event and calls `dispatch()`.
 */
import { registerEventHandlers } from '../../core/registry';
import { buildScheduledItemReminderContent } from './content';
import { resolveScheduledItemReminderRecipients } from './resolver';

export {
  buildScheduledItemReminderEvent,
  buildScheduledItemReminderUrl,
} from './resolver';
export { buildScheduledItemReminderContent } from './content';

registerEventHandlers('scheduled_item.reminder', {
  resolver: resolveScheduledItemReminderRecipients,
  contentBuilder: buildScheduledItemReminderContent,
});
