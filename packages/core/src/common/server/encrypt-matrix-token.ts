import { encryptAes256 } from './encrypt-aes';

const MATRIX_PASSWORD_SECRET = process.env.MATRIX_PASSWORD_SECRET ?? '';

export function encryptMatrixToken(token: string) {
  return encryptAes256(token, MATRIX_PASSWORD_SECRET);
}
