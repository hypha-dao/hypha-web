import type {
  NotificationContent,
  NotificationEvent,
  Recipient,
} from './types';

/** "What should this recipient receive, on which channels, gated by which tags?" */
export type ContentBuilder<E extends NotificationEvent = NotificationEvent> = (
  event: E,
  recipient: Recipient,
) => NotificationContent;
