import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Namespace marker so a leaked key is recognisable as a Hypha space key. */
export const SPACE_API_KEY_PREFIX = 'hyk';

const SECRET_BYTES = 32;
const PREFIX_CHARS = 8;

export type GeneratedSpaceApiKey = {
  /** Shown to the integrator exactly once; never persisted. */
  plaintext: string;
  /** Leading segment, safe to display in lists and logs. */
  prefix: string;
  hash: string;
};

export function hashSpaceApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext.trim(), 'utf8').digest('hex');
}

/**
 * Compare two hex digests without leaking length or content through timing.
 * Both inputs are digests, so a length mismatch already means "not equal".
 */
export function safeEqualHashes(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** `hyk_<8-char public prefix>_<43-char secret>`. */
export function generateSpaceApiKey(): GeneratedSpaceApiKey {
  const prefix = randomBytes(16)
    .toString('base64url')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, PREFIX_CHARS);
  const secret = randomBytes(SECRET_BYTES).toString('base64url');
  const plaintext = `${SPACE_API_KEY_PREFIX}_${prefix}_${secret}`;

  return { plaintext, prefix, hash: hashSpaceApiKey(plaintext) };
}
