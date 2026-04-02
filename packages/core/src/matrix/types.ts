import { Environment } from '../coherence/types';

export type MatrixUserLink = {
  id: number;
  privyUserId: string;
  matrixUserId: string;
  encryptedAccessToken: string;
  deviceId?: string;
  createdAt: Date;
  updatedAt: Date;
  encryptedRefreshToken?: string;
  tokenExpiresAt?: Date;
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
  content: string;
  timestamp: Date;
}
