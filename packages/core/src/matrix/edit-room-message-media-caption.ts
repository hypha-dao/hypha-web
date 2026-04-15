import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';

import {
  buildRichReplyMatrixContent,
  matrixTextEventContentWithOptionalFormatting,
} from './chat-markup';
import { MATRIX_CUSTOM_HTML_FORMAT } from './rich-reply';

/** Same shape as media events built in `matrix-provider` `editRoomMessage`. */
export type HyphaMediaEditCombined = RoomMessageEventContent & {
  format?: typeof MATRIX_CUSTOM_HTML_FORMAT;
  formatted_body?: string;
};

export type ReplyTargetResolved = {
  eventId: string;
  sender: string;
  body: string;
};

/**
 * Applies caption + optional rich-reply metadata to a media-edit `combined`
 * payload (used by `editRoomMessage` for `m.image` / `m.file` / `m.audio`).
 */
export async function applyMediaEditCaptionAndReply(
  combined: HyphaMediaEditCombined,
  trimmedCaption: string,
  replyToId: string | undefined,
  resolveReplyTarget: (replyToEventId: string) => Promise<ReplyTargetResolved>,
  filenameFallbackBody: string,
): Promise<HyphaMediaEditCombined> {
  if (trimmedCaption) {
    if (replyToId?.trim()) {
      const {
        eventId: resolvedReplyTargetId,
        sender: replyTargetSender,
        body: targetBody,
      } = await resolveReplyTarget(replyToId);
      const rich = buildRichReplyMatrixContent(
        replyTargetSender,
        targetBody,
        trimmedCaption,
      );
      return {
        ...combined,
        body: rich.body,
        format: MATRIX_CUSTOM_HTML_FORMAT,
        formatted_body: rich.formatted_body,
        'm.relates_to': {
          'm.in_reply_to': {
            event_id: resolvedReplyTargetId,
          },
        },
      } as HyphaMediaEditCombined;
    }
    const textExtras =
      matrixTextEventContentWithOptionalFormatting(trimmedCaption);
    return {
      ...combined,
      ...textExtras,
      body: trimmedCaption,
    } as HyphaMediaEditCombined;
  }

  if (replyToId?.trim()) {
    const {
      eventId: resolvedReplyTargetId,
      sender: replyTargetSender,
      body: targetBody,
    } = await resolveReplyTarget(replyToId);
    const quoted = buildRichReplyMatrixContent(
      replyTargetSender,
      targetBody,
      ' ',
    );
    return {
      ...combined,
      body: quoted.body,
      format: MATRIX_CUSTOM_HTML_FORMAT,
      formatted_body: quoted.formatted_body,
      'm.relates_to': {
        'm.in_reply_to': {
          event_id: resolvedReplyTargetId,
        },
      },
    } as HyphaMediaEditCombined;
  }

  return {
    ...combined,
    body: filenameFallbackBody,
  } as HyphaMediaEditCombined;
}
