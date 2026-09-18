import type { ChatNotificationEvent, NotificationDispatch } from './types';

/**
 * Temporary `dispatch()` seam until #2470's real decision/delivery layer lands.
 *
 * #2483 delivers the inbound half (receive → dedupe → parse → hand off); #2470 owns everything
 * downstream (recipient resolution, strategy, consent, channel delivery). Until `dispatch()`
 * exists, the route wires this: it records that a well-formed `ChatNotificationEvent` was
 * produced, without sending anything.
 *
 * TODO(#2470): replace with the real `dispatch` from the notification decision layer.
 */
export const loggingDispatch: NotificationDispatch = async (
  event: ChatNotificationEvent,
) => {
  console.info('[matrix-as] chat notification event (dispatch stub — #2470)', {
    type: event.type,
    matrixEventId: event.source.matrixEventId,
    roomId: event.roomId,
    context: event.context,
    actor: event.actor.matrixUserId,
    mentioned: event.payload.mentionedMatrixUserIds,
    bodyLength: event.payload.body.length,
  });
};
