import { describe, expect, it } from 'vitest';
import { hexToNpub, parseNip05Identifier, publicKeyForNip05 } from '../chat/identity.js';

describe('NIP-05 identity eligibility', () => {
  it('accepts Trustroots and Hitchwiki addresses', () => {
    expect(parseNip05Identifier('Tom@Trustroots.org')).toEqual({
      identifier: 'tom@trustroots.org', name: 'tom', domain: 'trustroots.org'
    });
    expect(parseNip05Identifier('Alice@Hitchwiki.org')).toEqual({
      identifier: 'alice@hitchwiki.org', name: 'alice', domain: 'hitchwiki.org'
    });
  });

  it('rejects unrelated domains and malformed names', () => {
    expect(() => parseNip05Identifier('tom@example.org')).toThrow('hitchwiki.org');
    expect(() => parseNip05Identifier('not an identifier')).toThrow('hitchwiki.org');
  });

  it('reads only a valid matching public key from a NIP-05 document', () => {
    const identity = parseNip05Identifier('tom@trustroots.org');
    const pubkey = 'a'.repeat(64);
    expect(publicKeyForNip05(identity, { names: { tom: pubkey } })).toBe(pubkey);
    expect(() => publicKeyForNip05(identity, { names: { tom: 'npub1not-a-hex-key' } })).toThrow('valid Nostr public key');
  });

  it('formats signer keys as npub instead of hexadecimal', () => {
    expect(hexToNpub('0'.repeat(64))).toBe('npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqujme');
    expect(() => hexToNpub('not-hex')).toThrow('Invalid Nostr public key');
  });
});
