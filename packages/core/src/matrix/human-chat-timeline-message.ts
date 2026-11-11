import type { MatrixEvent } from 'matrix-js-sdk';
import { EventType } from 'matrix-js-sdk';
import { isCallCaptureNoticeEvent } from './client/hooks/call-capture-consent';
import { isCallEphemeralRoomMessageEvent } from './client/hooks/call-reactions';
import { isScreenshareTakeoverEvent } from './client/hooks/screenshare-takeover';
import {
  parseSignalTeamNoticeFromWireContent,
  shouldIncludeSignalTeamNoticeInChatTimeline,
} from './signal-team-events';

/**
 * Room messages the human chat timeline does not render: call notices,
 * screenshare takeover, and legacy signal-team roster posts. The signal
 * comment count uses the same predicate so it matches the bubbles.
 */
export function isHiddenHumanChatRoomMessage(event: MatrixEvent): boolean {
  if (event.getType() !== EventType.RoomMessage) return false;
  if (isCallCaptureNoticeEvent(event)) return true;
  if (isCallEphemeralRoomMessageEvent(event)) return true;
  if (isScreenshareTakeoverEvent(event)) return true;
  const content = event.getContent() as Record<string, unknown>;
  const body = typeof content.body === 'string' ? content.body : '';
  const signalTeamNotice = parseSignalTeamNoticeFromWireContent(content, body);
  if (
    signalTeamNotice &&
    !shouldIncludeSignalTeamNoticeInChatTimeline(signalTeamNotice)
  ) {
    return true;
  }
  return false;
}
