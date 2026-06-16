import { Environment } from '../coherence/types';
import type { SignalTeamNotice } from './signal-team-events';

export type MatrixUserLink = {
  id: number;
  environment: Environment;
  privyUserId: string;
  matrixUserId: string;
  encryptedAccessToken: string;
  deviceId: string | null;
  createdAt: Date;
  updatedAt: Date;
  encryptedRefreshToken: string | null;
  tokenExpiresAt: Date | null;
};

/** Default Matrix access token lifetime (seconds) when homeserver omits expires_in. */
export const MATRIX_ACCESS_TOKEN_TTL_SEC = 3600;

export interface CreateMatrixUserLinkInput {
  environment: Environment;
  privyUserId: string;
  matrixUserId: string;
  encryptedAccessToken: string;
  deviceId?: string;
}

export interface UpdateEncryptedAccessTokenInput {
  privyUserId: string;
  encryptedAccessToken: string;
  deviceId?: string | null;
  environment: Environment;
}

export interface GetMatrixUserLinkActionInput {
  environment: Environment;
  privyUserId: string;
}

export interface GetAdminUserNameActionInput {
  baseName: string;
  environment: Environment;
}

/** Aggregated Matrix reaction (m.annotation) on an m.room.message. */
export interface MessageReaction {
  key: string;
  count: number;
  includesCurrentUser?: boolean;
  /** Current user's m.reaction event id for this key (for toggle off). */
  currentUserReactionEventId?: string;
  /** Distinct Matrix user ids who reacted with this key (for hover UI). */
  reactorUserIds?: string[];
}

/** Matrix `m.room.message` media payload mapped for Hypha UI. */
export type MessageMediaInfo = {
  mimetype?: string;
  size?: number;
  w?: number;
  h?: number;
  /** Matrix `m.audio` / MSC1767: duration in milliseconds */
  duration?: number;
};

/** One slot in a multi-attachment `org.hypha.media_bundle` message. */
export type MessageMediaBundleItem = {
  msgtype: 'm.file' | 'm.image' | 'm.audio';
  mxcUrl?: string;
  filename?: string;
  mediaInfo?: MessageMediaInfo;
  spoiler?: boolean;
};

export interface Message {
  id: string;
  sender: string;
  /** Synthetic row from a redaction handler: remove this timeline id from UI. */
  redacted?: boolean;
  /** Matrix msgtype for timeline rendering (`m.text` is implicit when omitted). */
  msgtype?: 'm.text' | 'm.file' | 'm.image' | 'm.audio';
  /** Visible message text (reply fallback stripped when applicable). */
  content: string;
  /**
   * Matrix `formatted_body` for the visible reply (after stripping quote fallback),
   * when `format` was `org.matrix.custom.html`. Used for rich timeline rendering.
   */
  formattedContentHtml?: string;
  timestamp: Date;
  pinned?: boolean;
  /** Matrix rich reply: event_id of the message being replied to. */
  inReplyToEventId?: string;
  inReplyToSender?: string;
  /** Truncated excerpt for UI; omit when unknown or redacted. */
  inReplyToBodyPreview?: string;
  /** Aggregated emoji reactions for this message. */
  reactions?: MessageReaction[];
  /** Primary media URL (`mxc://`) for `m.file` / `m.image`. */
  mxcUrl?: string;
  /** Original filename when `msgtype` is file or image. */
  filename?: string;
  mediaInfo?: MessageMediaInfo;
  /** Hypha extension: blur media until clicked. */
  spoiler?: boolean;
  /**
   * Hypha `org.hypha.media_bundle`: multiple files/images in one timeline event.
   * When set, index 0 matches root `msgtype`/`mxcUrl`/…; further indices are bundle slots.
   */
  mediaBundle?: MessageMediaBundleItem[];
  /**
   * Matrix MSC3952 intentional mentions (`content.m.mentions.user_ids`).
   */
  mentionedUserIds?: string[];
  /** Hypha signal-team system notice parsed from structured Matrix content. */
  signalTeamNotice?: SignalTeamNotice;
}
