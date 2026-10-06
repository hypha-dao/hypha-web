import type { DecidedNotification } from '../core/types';

export interface DispatchResult {
  sent: number;
  failed: number;
}

/**
 * The port that keeps open question 5 (a Matrix-native delivery adapter) cheap
 * (implementation-plan.md §2, §5): the decision layer only ever talks to this interface.
 * OneSignal (`onesignal-adapter.ts`) is the only implementation today.
 */
export interface NotificationDispatcher {
  sendMany(notifications: DecidedNotification[]): Promise<DispatchResult>;
}
