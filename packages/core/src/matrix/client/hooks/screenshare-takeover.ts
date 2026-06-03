import type * as MatrixSdk from 'matrix-js-sdk';
import { EventType, MsgType } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';

export const SCREENSHARE_TAKEOVER_TYPE = 'io.hypha.screenshare_takeover.v1';

export type ScreenshareTakeoverAction =
  | 'request'
  | 'approve'
  | 'deny'
  | 'cancel';

export type ScreenshareTakeoverWire = {
  [SCREENSHARE_TAKEOVER_TYPE]?: boolean;
  action?: ScreenshareTakeoverAction;
  request_id?: string;
  requester_user_id?: string;
  target_user_id?: string;
};

export type ScreenshareTakeoverIncoming = {
  requestId: string;
  requesterUserId: string;
  requesterLabel: string;
};

export type ScreenshareTakeoverOutcome = 'approved' | 'denied';

const MAX_TAKEOVER_AGE_MS = 5 * 60 * 1000;

export function isScreenshareTakeoverEvent(
  event: MatrixSdk.MatrixEvent,
): boolean {
  if (event.getType() !== EventType.RoomMessage) return false;
  const content = event.getContent() as ScreenshareTakeoverWire;
  return content[SCREENSHARE_TAKEOVER_TYPE] === true;
}

export function getRemoteScreenshareOwner(
  groupCall: MatrixSdk.GroupCall | null | undefined,
): { userId: string; deviceId: string } | null {
  if (!groupCall) return null;
  for (const feed of groupCall.screenshareFeeds) {
    if (feed.isLocal()) continue;
    const userId = feed.userId?.trim();
    if (!userId) continue;
    return { userId, deviceId: feed.deviceId?.trim() ?? '' };
  }
  return null;
}

/** True when another participant is presenting — only one share at a time (CSH-SHARE-3). */
export function isRemoteScreenshareActive(
  groupCall: MatrixSdk.GroupCall | null | undefined,
): boolean {
  return getRemoteScreenshareOwner(groupCall) != null;
}

export function canStartLocalScreenshare(
  groupCall: MatrixSdk.GroupCall | null | undefined,
): boolean {
  if (!groupCall || groupCall.isScreensharing()) return true;
  return !isRemoteScreenshareActive(groupCall);
}

function isRecentTakeoverEvent(event: MatrixSdk.MatrixEvent): boolean {
  const ts = event.getTs();
  if (!ts) return false;
  return Date.now() - ts <= MAX_TAKEOVER_AGE_MS;
}

/** Newest unanswered takeover request for the local sharer. */
export function resolveIncomingScreenshareTakeover(
  eventsNewestFirst: MatrixSdk.MatrixEvent[],
  localUserId: string | null,
  isLocalScreensharing: boolean,
  resolveLabel: (userId: string) => string,
): ScreenshareTakeoverIncoming | null {
  if (!localUserId || !isLocalScreensharing) return null;

  const answered = new Set<string>();
  let pending: ScreenshareTakeoverIncoming | null = null;

  for (const event of eventsNewestFirst) {
    if (!isScreenshareTakeoverEvent(event) || !isRecentTakeoverEvent(event)) {
      continue;
    }
    const content = event.getContent() as ScreenshareTakeoverWire;
    const requestId = content.request_id?.trim();
    const action = content.action;
    if (!requestId || !action) continue;

    if (action === 'approve' || action === 'deny' || action === 'cancel') {
      answered.add(requestId);
      continue;
    }
    if (action !== 'request') continue;
    if (answered.has(requestId)) continue;

    const requesterUserId = content.requester_user_id?.trim() ?? '';
    if (!requesterUserId || requesterUserId === localUserId) continue;

    const targetUserId = content.target_user_id?.trim();
    if (targetUserId && targetUserId !== localUserId) continue;

    pending = {
      requestId,
      requesterUserId,
      requesterLabel: resolveLabel(requesterUserId) || requesterUserId,
    };
    break;
  }

  return pending;
}

/** Outcome for the local requester waiting on sharer approval. */
export function resolveScreenshareTakeoverOutcome(
  eventsNewestFirst: MatrixSdk.MatrixEvent[],
  localUserId: string | null,
  pendingRequestId: string | null,
): ScreenshareTakeoverOutcome | null {
  if (!localUserId || !pendingRequestId) return null;

  for (const event of eventsNewestFirst) {
    if (!isScreenshareTakeoverEvent(event) || !isRecentTakeoverEvent(event)) {
      continue;
    }
    const content = event.getContent() as ScreenshareTakeoverWire;
    if (content.request_id?.trim() !== pendingRequestId) continue;
    const requesterUserId = content.requester_user_id?.trim();
    if (requesterUserId && requesterUserId !== localUserId) continue;

    if (content.action === 'approve') return 'approved';
    if (content.action === 'deny') return 'denied';
    if (content.action === 'cancel') return 'denied';
  }
  return null;
}

export function buildScreenshareTakeoverContent(
  action: ScreenshareTakeoverAction,
  requestId: string,
  requesterUserId: string,
  targetUserId?: string,
): RoomMessageEventContent {
  const body =
    action === 'request'
      ? 'Screen share takeover request'
      : action === 'approve'
      ? 'Screen share takeover approved'
      : action === 'deny'
      ? 'Screen share takeover denied'
      : 'Screen share takeover cancelled';
  return {
    msgtype: MsgType.Notice,
    body,
    [SCREENSHARE_TAKEOVER_TYPE]: true,
    action,
    request_id: requestId,
    requester_user_id: requesterUserId,
    ...(targetUserId ? { target_user_id: targetUserId } : {}),
  } as RoomMessageEventContent;
}
