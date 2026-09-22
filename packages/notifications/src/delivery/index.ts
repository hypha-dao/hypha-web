import { onesignalDispatcher } from './onesignal-adapter';
import type { NotificationDispatcher } from './types';

export * from './types';
export { onesignalDispatcher } from './onesignal-adapter';

let activeDispatcher: NotificationDispatcher = onesignalDispatcher;

/** Test seam — swap the delivery-layer implementation without touching the decision layer. */
export function setNotificationDispatcher(
  dispatcher: NotificationDispatcher,
): void {
  activeDispatcher = dispatcher;
}

export function getNotificationDispatcher(): NotificationDispatcher {
  return activeDispatcher;
}
