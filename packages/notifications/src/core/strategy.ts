import type { NotificationEvent, Recipient } from './types';

/** "Does this recipient want this event?" — evaluated before fan-out/send, not after. */
export type NotificationStrategy<
  E extends NotificationEvent = NotificationEvent,
> = (event: E, recipient: Recipient) => boolean;

/** Default for event types with no registered strategy — resolver already scoped the recipients. */
export const passThroughStrategy: NotificationStrategy = () => true;
