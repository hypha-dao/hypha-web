import crypto from 'node:crypto';

const algorithm = 'aes-256-cbc';
const ivLength = 16;

function validateAesKey(secretKey: string): void {
  if (typeof secretKey !== 'string' || !/^[0-9a-fA-F]{64}$/.test(secretKey)) {
    throw new Error('Invalid AES-256 key: expected 64 hex chars (32 bytes)');
  }
}

function encryptAes256(text: string, secretKey: string): string {
  validateAesKey(secretKey);
  // Generate a random IV for each encryption
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(
    algorithm,
    Buffer.from(secretKey, 'hex'),
    iv,
  );
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  // Combine IV and encrypted data for storage/transmission
  return iv.toString('hex') + ':' + encrypted;
}

function decryptAes256(encryptedText: string, secretKey: string): string {
  validateAesKey(secretKey);
  // Split the combined string to retrieve the IV and actual data
  const parts = encryptedText.split(':');
  const ivRaw = parts.shift();
  if (!ivRaw) {
    throw new Error('Malformed encrypted text: missing IV');
  }
  const iv = Buffer.from(ivRaw, 'hex');
  const encrypted = parts.join(':');
  const decipher = crypto.createDecipheriv(
    algorithm,
    Buffer.from(secretKey, 'hex'),
    iv,
  );
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function hashHmacSha1Hex(text: string, key: string): string {
  return crypto.createHmac('sha1', key).update(text).digest('hex');
}

export { encryptAes256, decryptAes256, hashHmacSha1Hex };
