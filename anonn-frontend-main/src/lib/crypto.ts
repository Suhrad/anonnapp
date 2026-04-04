/**
 * E2EE crypto utilities for Anonn
 *
 * Encryption stack:
 *   - Identity key:  PBKDF2(walletSign("ANONN_IDENTITY_V1"), salt, 100_000, 32, SHA-256)
 *                    Derived client-side only. Never sent to server.
 *   - Chat keypair:  X25519 (nacl.box.keyPair). Public key stored on server.
 *                    Private key stored in localStorage encrypted with identityKey.
 *   - Group key:     nacl.randomBytes(32) symmetric key per group.
 *                    Distributed to each member as nacl.box(groupKey, nonce, memberPubKey, senderSecretKey).
 *   - Messages:      nacl.secretbox(plaintext, nonce, groupKey) — XSalsa20-Poly1305.
 */

import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

// ─── Identity key derivation ────────────────────────────────────────────────

/**
 * Derive a 256-bit identity key from a wallet signature.
 * The key is used to encrypt/decrypt the local E2EE private key.
 *
 * @param walletSignatureBase64  base64 of the wallet's signature over "ANONN_IDENTITY_V1"
 * @param saltBase64             base64 of 16-byte random salt (generated once, stored server-side in IdentityMapping)
 */
export async function deriveIdentityKey(
  walletSignatureBase64: string,
  saltBase64: string
): Promise<CryptoKey> {
  const signatureBytes = decodeBase64(walletSignatureBase64);
  const salt = decodeBase64(saltBase64);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    signatureBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── AES-GCM helpers (for encrypting secret key in localStorage) ─────────────

export async function aesEncrypt(
  key: CryptoKey,
  data: Uint8Array
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return {
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
    iv: encodeBase64(iv),
  };
}

export async function aesDecrypt(
  key: CryptoKey,
  ciphertextBase64: string,
  ivBase64: string
): Promise<Uint8Array> {
  const iv = decodeBase64(ivBase64);
  const ciphertext = decodeBase64(ciphertextBase64);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new Uint8Array(plaintext);
}

// ─── X25519 keypair management ───────────────────────────────────────────────

export interface EncryptedKeyPair {
  publicKeyBase64: string;
  encryptedSecretKey: string; // base64 AES-GCM ciphertext
  secretKeyIv: string;        // base64 IV
  secretKey: Uint8Array;      // raw secret key (do not persist; use only in-memory / sessionStorage)
}

/**
 * Generate a new X25519 keypair and immediately encrypt the secret key
 * with the identity key so it can be safely stored in localStorage.
 * Also returns the raw secret key for immediate in-memory use.
 */
export async function generateEncryptionKeyPair(
  identityKey: CryptoKey
): Promise<EncryptedKeyPair> {
  const keyPair = nacl.box.keyPair();
  const { ciphertext, iv } = await aesEncrypt(identityKey, keyPair.secretKey);
  return {
    publicKeyBase64: encodeBase64(keyPair.publicKey),
    encryptedSecretKey: ciphertext,
    secretKeyIv: iv,
    secretKey: keyPair.secretKey,
  };
}

/**
 * Restore the X25519 secret key from localStorage using the identity key.
 */
export async function restoreSecretKey(
  identityKey: CryptoKey,
  encryptedSecretKey: string,
  secretKeyIv: string
): Promise<Uint8Array> {
  return aesDecrypt(identityKey, encryptedSecretKey, secretKeyIv);
}

// ─── Group key distribution (nacl.box) ───────────────────────────────────────

/**
 * Encrypt the group symmetric key for a specific member using their X25519 public key.
 * Uses nacl.box (Curve25519-XSalsa20-Poly1305).
 */
export function encryptGroupKeyForMember(
  groupKey: Uint8Array,
  recipientPublicKeyBase64: string,
  senderSecretKey: Uint8Array
): { encryptedKey: string; nonce: string; senderPublicKey: string } {
  const recipientPublicKey = decodeBase64(recipientPublicKeyBase64);
  const senderKeyPair = nacl.box.keyPair.fromSecretKey(senderSecretKey);
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const encrypted = nacl.box(groupKey, nonce, recipientPublicKey, senderSecretKey);

  return {
    encryptedKey: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
    senderPublicKey: encodeBase64(senderKeyPair.publicKey),
  };
}

/**
 * Decrypt the group symmetric key using the recipient's secret key.
 */
export function decryptGroupKey(
  encryptedKeyBase64: string,
  nonceBase64: string,
  senderPublicKeyBase64: string,
  recipientSecretKey: Uint8Array
): Uint8Array | null {
  const encryptedKey = decodeBase64(encryptedKeyBase64);
  const nonce = decodeBase64(nonceBase64);
  const senderPublicKey = decodeBase64(senderPublicKeyBase64);
  return nacl.box.open(encryptedKey, nonce, senderPublicKey, recipientSecretKey);
}

// ─── Group message encryption/decryption (nacl.secretbox) ───────────────────

/**
 * Encrypt a plaintext message with the group symmetric key.
 * Returns base64-encoded ciphertext and nonce to send to the server.
 */
export function encryptMessage(
  plaintext: string,
  groupKey: Uint8Array
): { content: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageBytes = decodeUTF8(plaintext);
  const ciphertext = nacl.secretbox(messageBytes, nonce, groupKey);
  return {
    content: encodeBase64(ciphertext),
    nonce: encodeBase64(nonce),
  };
}

/**
 * Decrypt a ciphertext message with the group symmetric key.
 * Returns the plaintext string, or null if decryption fails.
 */
export function decryptMessage(
  ciphertextBase64: string,
  nonceBase64: string,
  groupKey: Uint8Array
): string | null {
  const ciphertext = decodeBase64(ciphertextBase64);
  const nonce = decodeBase64(nonceBase64);
  const plaintext = nacl.secretbox.open(ciphertext, nonce, groupKey);
  if (!plaintext) return null;
  return encodeUTF8(plaintext);
}

// ─── localStorage key names ───────────────────────────────────────────────────

export const STORAGE_KEYS = {
  /** base64 X25519 public key */
  PUBLIC_KEY: 'anonn_pub_key',
  /** AES-GCM encrypted X25519 secret key */
  ENCRYPTED_SECRET_KEY: 'anonn_enc_sec_key',
  /** IV for the encrypted secret key */
  SECRET_KEY_IV: 'anonn_sec_key_iv',
  /** Per-group decrypted symmetric key cache — prefix + groupId */
  GROUP_KEY_PREFIX: 'anonn_gk_',
  /** Session-cached decrypted secret key (cleared on tab close) */
  SESSION_SECRET_KEY: 'anonn_session_sk',
} as const;

/** Cache a decrypted group key in sessionStorage (cleared on tab close) */
export function cacheGroupKey(groupId: string, groupKey: Uint8Array): void {
  sessionStorage.setItem(STORAGE_KEYS.GROUP_KEY_PREFIX + groupId, encodeBase64(groupKey));
}

/** Retrieve a cached group key from sessionStorage */
export function getCachedGroupKey(groupId: string): Uint8Array | null {
  const stored = sessionStorage.getItem(STORAGE_KEYS.GROUP_KEY_PREFIX + groupId);
  if (!stored) return null;
  return decodeBase64(stored);
}

/**
 * Cache the decrypted X25519 secret key in sessionStorage.
 * This avoids requiring another wallet signature per tab/refresh.
 * sessionStorage is cleared when the tab closes.
 */
export function cacheSecretKey(secretKey: Uint8Array): void {
  sessionStorage.setItem(STORAGE_KEYS.SESSION_SECRET_KEY, encodeBase64(secretKey));
}

/** Retrieve the session-cached secret key, or null if not available */
export function getSessionSecretKey(): Uint8Array | null {
  const stored = sessionStorage.getItem(STORAGE_KEYS.SESSION_SECRET_KEY);
  if (!stored) return null;
  return decodeBase64(stored);
}
