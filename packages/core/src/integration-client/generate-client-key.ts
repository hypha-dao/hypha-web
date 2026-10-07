import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Namespace marker so a leaked key is recognisable as a Hypha client key. */
export const INTEGRATION_CLIENT_KEY_PREFIX = 'hyc';

const SECRET_BYTES = 32;
const PREFIX_CHARS = 8;

export type GeneratedClientKey = {
  /** Shown to the integrator exactly once; never persisted. */
  plaintext: string;
  /** Leading segment, safe to display in lists and logs. */
  prefix: string;
  hash: string;
};

/**
 * Digest a key for storage and for resolving it on each request. SHA-256 is
 * enough: the key is 256 random bits, not a human-chosen secret, so a slow KDF
 * adds nothing, and a salted digest could not be used to look the key up.
 */
export function hashClientKey(plaintext: string): string {
  return createHash('sha256').update(plaintext.trim(), 'utf8').digest('hex');
}

/** Compare two hex digests without leaking content through timing. */
export function safeEqualClientKeyHashes(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** `hyc_<8-char public prefix>_<43-char secret>`. */
export function generateClientKey(): GeneratedClientKey {
  const prefix = randomBytes(16)
    .toString('base64url')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, PREFIX_CHARS);
  const secret = randomBytes(SECRET_BYTES).toString('base64url');
  const plaintext = `${INTEGRATION_CLIENT_KEY_PREFIX}_${prefix}_${secret}`;

  return { plaintext, prefix, hash: hashClientKey(plaintext) };
}
