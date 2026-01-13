export type MatrixUserLink = {
  id: number;
  privyUserId: string;
  matrixUserId: string;
  encryptedAccessToken: string;
  deviceId?: string;
  createdAt: Date;
  updatedAt: Date;
  refreshToken?: string;
  tokenExpiresAt?: Date;
};

export interface CreateMatrixUserLinkInput {
  privyUserId: string;
  matrixUserId: string;
  encryptedAccessToken: string;
  deviceId?: string;
}

export interface UpdateEncryptedAccessTokenInput {
  privyUserId: string;
  encryptedAccessToken: string;
}
