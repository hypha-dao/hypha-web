import type { MatrixEvent } from 'matrix-js-sdk';
import { EventType } from 'matrix-js-sdk';
import { CALL_CAPTURE_NOTICE_TYPE } from './client/hooks/call-capture-consent';
import {
  CALL_RAISE_HAND_NOTICE_TYPE,
  CALL_SESSION_ANCHOR_TYPE,
} from './client/hooks/call-reactions';
import { SCREENSHARE_TAKEOVER_TYPE } from './client/hooks/screenshare-takeover';
import {
  parseSignalTeamNoticeFromWireContent,
  shouldIncludeSignalTeamNoticeInChatTimeline,
} from './signal-team-events';

/**
 * Wire content the human chat timeline does not render: call notices,
 * screenshare takeover, and legacy signal-team roster posts. The signal
 * comment count uses this same check.
 */
export function isHiddenHumanChatMessageContent(
  content: Record<string, unknown> | null | undefined,
): boolean {
  if (!content) return false;
  if (content[CALL_CAPTURE_NOTICE_TYPE] === true) return true;
  if (content[CALL_SESSION_ANCHOR_TYPE] === true) return true;
  if (content[CALL_RAISE_HAND_NOTICE_TYPE] === true) return true;
  if (content[SCREENSHARE_TAKEOVER_TYPE] === true) return true;
  const body = typeof content.body === 'string' ? content.body : '';
  const signalTeamNotice = parseSignalTeamNoticeFromWireContent(content, body);
  return Boolean(
    signalTeamNotice &&
      !shouldIncludeSignalTeamNoticeInChatTimeline(signalTeamNotice),
  );
}

/**
 * Room messages the human chat timeline does not render. Same predicate as
 * `isHiddenHumanChatMessageContent`.
 */
export function isHiddenHumanChatRoomMessage(event: MatrixEvent): boolean {
  if (event.getType() !== EventType.RoomMessage) return false;
  return isHiddenHumanChatMessageContent(
    event.getContent() as Record<string, unknown>,
  );
}
