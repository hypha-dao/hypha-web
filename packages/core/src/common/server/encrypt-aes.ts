import crypto from 'node:crypto';

const algorithm = 'aes-256-cbc';
const ivLength = 16;

function encryptAes256(text: string, secretKey: string): string {
  if (!secretKey) {
    throw new Error('Secret key is incorrect');
  }
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
  if (!secretKey) {
    throw new Error('Secret key is incorrect');
  }
  // Split the combined string to retrieve the IV and actual data
  const parts = encryptedText.split(':');
  const ivRaw = parts.shift();
  if (ivRaw === undefined) {
    return '';
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
