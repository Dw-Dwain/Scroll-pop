/**
 * AES-256-GCM encryption for OAuth access tokens stored in the database.
 *
 * Key: SHOPIFY_ENCRYPTION_KEY env var — 32 bytes encoded as base64.
 * Generate a key: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * Stored format: "enc:<base64(iv[12] + authTag[16] + ciphertext)>"
 * Legacy tokens (not prefixed with "enc:") are returned as-is so existing
 * installations keep working — they'll be re-encrypted on the next OAuth re-auth.
 */

import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer | null {
  const b64 = process.env['SHOPIFY_ENCRYPTION_KEY'];
  if (!b64) {
    // In production a missing key must be a hard failure — silently storing OAuth tokens
    // and ESP/webhook secrets as plaintext is a data-at-rest breach waiting to happen (M-3).
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('SHOPIFY_ENCRYPTION_KEY is required in production — refusing to store secrets as plaintext');
    }
    return null;
  }
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) {
    throw new Error('SHOPIFY_ENCRYPTION_KEY must be exactly 32 bytes (base64-encoded)');
  }
  return key;
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext; // No key configured — store as plaintext (dev/unconfigured only; prod throws above)

  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'enc:' + Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptToken(stored: string): string {
  if (!stored.startsWith('enc:')) return stored; // Legacy plaintext — pass through

  const key = getKey();
  if (!key) {
    throw new Error('SHOPIFY_ENCRYPTION_KEY is required to decrypt stored token');
  }

  const combined = Buffer.from(stored.slice(4), 'base64');
  if (combined.length < IV_LEN + TAG_LEN) {
    throw new Error('Malformed encrypted token');
  }

  const iv         = combined.subarray(0, IV_LEN);
  const tag        = combined.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = combined.subarray(IV_LEN + TAG_LEN);

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}
