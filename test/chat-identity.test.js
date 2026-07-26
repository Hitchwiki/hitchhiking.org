import { describe, expect, it } from 'vitest';
import { parseNip05Identifier, publicKeyForNip05 } from '../chat/identity.js';

describe('NIP-05 identity eligibility', () => {
  it('accepts Hitchwiki and Trustroots addresses', () => {
    expect(parseNip05Identifier('Tom@Trustroots.org')).toEqual({
      identifier: 'tom@trustroots.org', name: 'tom', domain: 'trustroots.org'
    });
    expect(parseNip05Identifier('alice@hitchwiki.org').name).toBe('alice');
  });

  it('rejects unrelated domains and malformed names', () => {
    expect(() => parseNip05Identifier('tom@example.org')).toThrow('hitchwiki.org or trustroots.org');
    expect(() => parseNip05Identifier('not an identifier')).toThrow('hitchwiki.org or trustroots.org');
  });

  it('reads only a valid matching public key from a NIP-05 document', () => {
    const identity = parseNip05Identifier('tom@trustroots.org');
    const pubkey = 'a'.repeat(64);
    expect(publicKeyForNip05(identity, { names: { tom: pubkey } })).toBe(pubkey);
    expect(() => publicKeyForNip05(identity, { names: { tom: 'npub1not-a-hex-key' } })).toThrow('valid Nostr public key');
  });
});
