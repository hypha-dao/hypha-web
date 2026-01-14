import { decryptAes256 } from './encrypt-aes';

const MATRIX_PASSWORD_SECRET = process.env.MATRIX_PASSWORD_SECRET ?? '';

export function decryptMatrixToken(encryptedToken: string) {
  return decryptAes256(encryptedToken, MATRIX_PASSWORD_SECRET);
}
