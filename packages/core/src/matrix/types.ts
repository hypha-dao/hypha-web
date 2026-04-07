import { Environment } from '../coherence/types';

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

export interface Message {
  id: string;
  sender: string;
  /** Visible message text (reply fallback stripped when applicable). */
  content: string;
  timestamp: Date;
  pinned?: boolean;
  /** Matrix rich reply: event_id of the message being replied to. */
  inReplyToEventId?: string;
  inReplyToSender?: string;
  /** Truncated excerpt for UI; omit when unknown or redacted. */
  inReplyToBodyPreview?: string;
}
