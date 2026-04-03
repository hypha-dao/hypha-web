import { encryptAes256 } from './encrypt-aes';

function getMatrixPasswordSecret(): string {
  const secret = process.env.MATRIX_PASSWORD_SECRET;
  if (!secret) {
    throw new Error(
      'MATRIX_PASSWORD_SECRET is not set. Please set this environment variable.',
    );
  }
  return secret;
}

export function encryptMatrixToken(token: string) {
  return encryptAes256(token, getMatrixPasswordSecret());
}
