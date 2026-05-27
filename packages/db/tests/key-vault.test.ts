import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  decryptKey,
  encryptKey,
  loadMasterKey,
} from '../src/services/key-vault.js';

const TEST_MASTER_B64 = crypto.randomBytes(32).toString('base64');

describe('KeyVaultService — crypto primitives', () => {
  it('rejects an unset master key', () => {
    expect(() => loadMasterKey(undefined)).toThrow(/KEY_VAULT_MASTER_KEY/);
    expect(() => loadMasterKey('')).toThrow(/KEY_VAULT_MASTER_KEY/);
  });

  it('rejects a master key with the wrong length', () => {
    expect(() => loadMasterKey(Buffer.alloc(16).toString('base64'))).toThrow(/32 bytes/);
  });

  it('round-trips a plaintext through encrypt → decrypt', () => {
    const master = loadMasterKey(TEST_MASTER_B64);
    const plaintext = 'sk-test-abc123def456';
    const material = encryptKey(master, plaintext);

    expect(material.lastFour).toBe('f456');
    expect(material.iv.length).toBe(12);
    expect(material.authTag.length).toBe(16);
    expect(material.encrypted.length).toBeGreaterThan(0);
    expect(material.encrypted.toString('utf8')).not.toBe(plaintext);

    const recovered = decryptKey(master, {
      encryptedKey: material.encrypted,
      iv: material.iv,
      authTag: material.authTag,
    });
    expect(recovered).toBe(plaintext);
  });

  it('produces distinct ciphertexts for the same plaintext (random IV)', () => {
    const master = loadMasterKey(TEST_MASTER_B64);
    const a = encryptKey(master, 'sk-same-input');
    const b = encryptKey(master, 'sk-same-input');
    expect(a.encrypted.equals(b.encrypted)).toBe(false);
    expect(a.iv.equals(b.iv)).toBe(false);
  });

  it('models key rotation as fresh encrypted material', () => {
    const master = loadMasterKey(TEST_MASTER_B64);
    const first = encryptKey(master, 'sk-old-secret');
    const rotated = encryptKey(master, 'sk-new-secret');

    expect(first.lastFour).toBe('cret');
    expect(rotated.lastFour).toBe('cret');
    expect(first.encrypted.equals(rotated.encrypted)).toBe(false);
    expect(first.iv.equals(rotated.iv)).toBe(false);
    expect(
      decryptKey(master, {
        encryptedKey: rotated.encrypted,
        iv: rotated.iv,
        authTag: rotated.authTag,
      }),
    ).toBe('sk-new-secret');
  });

  it('fails decryption when the auth tag is tampered with', () => {
    const master = loadMasterKey(TEST_MASTER_B64);
    const material = encryptKey(master, 'sk-tamper-test');
    const tamperedTag = Buffer.from(material.authTag);
    tamperedTag[0] = (tamperedTag[0] ?? 0) ^ 0xff;

    expect(() =>
      decryptKey(master, {
        encryptedKey: material.encrypted,
        iv: material.iv,
        authTag: tamperedTag,
      }),
    ).toThrow();
  });

  it('fails decryption when the ciphertext is tampered with', () => {
    const master = loadMasterKey(TEST_MASTER_B64);
    const material = encryptKey(master, 'sk-tamper-ciphertext');
    const tampered = Buffer.from(material.encrypted);
    tampered[0] = (tampered[0] ?? 0) ^ 0x01;

    expect(() =>
      decryptKey(master, {
        encryptedKey: tampered,
        iv: material.iv,
        authTag: material.authTag,
      }),
    ).toThrow();
  });

  it('fails decryption with the wrong master key', () => {
    const masterA = loadMasterKey(TEST_MASTER_B64);
    const masterB = loadMasterKey(crypto.randomBytes(32).toString('base64'));
    const material = encryptKey(masterA, 'sk-wrong-key');

    expect(() =>
      decryptKey(masterB, {
        encryptedKey: material.encrypted,
        iv: material.iv,
        authTag: material.authTag,
      }),
    ).toThrow();
  });

  it('refuses to encrypt an empty plaintext', () => {
    const master = loadMasterKey(TEST_MASTER_B64);
    expect(() => encryptKey(master, '')).toThrow(/non-empty/);
  });

  it('handles short plaintexts where last 4 chars equal the whole string', () => {
    const master = loadMasterKey(TEST_MASTER_B64);
    const material = encryptKey(master, 'abcd');
    expect(material.lastFour).toBe('abcd');
    const recovered = decryptKey(master, {
      encryptedKey: material.encrypted,
      iv: material.iv,
      authTag: material.authTag,
    });
    expect(recovered).toBe('abcd');
  });
});
