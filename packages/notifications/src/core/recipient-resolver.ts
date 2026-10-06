import type { NotificationEvent, Recipient } from './types';

/** "Who could this event possibly notify?" — membership/consent-agnostic; strategy and consent narrow it further. */
export type RecipientResolver<E extends NotificationEvent = NotificationEvent> =
  (event: E) => Promise<Recipient[]>;
