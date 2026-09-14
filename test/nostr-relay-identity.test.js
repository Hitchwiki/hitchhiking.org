import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupRelayIdentity } from '../assets/nostr-relay-identity.js';

const pubkey = 'a'.repeat(64);
const relay = 'wss://nip42.trustroots.org';
let socket;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', class {
    sent = [];
    close = vi.fn();
    constructor() { socket = this; }
    send(raw) { this.sent.push(JSON.parse(raw)); }
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const emit = (message) => socket.onmessage({ data: JSON.stringify(message) });
const profile = (key = pubkey) => ({ kind: 10390, pubkey: key, tags: [['l', 'alice', 'org.trustroots:username']], content: '' });

describe('relay identity protocol', () => {
  it('waits for the matching AUTH acknowledgement, then resubscribes', async () => {
    const signer = { signEvent: vi.fn(async (event) => ({ ...event, pubkey, id: 'auth-id' })) };
    const result = lookupRelayIdentity(pubkey, relay, signer);
    socket.onopen();
    const subscription = socket.sent[0][1];
    await emit(['AUTH', 'challenge']);
    await emit(['CLOSED', subscription, 'auth-required:']);
    await emit(['EOSE', subscription]);
    await emit(['OK', 'another-event', true, '']);
    expect(socket.sent.filter(([type]) => type === 'REQ')).toHaveLength(1);
    await emit(['OK', 'auth-id', true, '']);
    expect(socket.sent.filter(([type]) => type === 'REQ')).toHaveLength(2);
    await emit(['EVENT', 'wrong-subscription', profile()]);
    await emit(['EVENT', subscription, profile('b'.repeat(64))]);
    expect(socket.close).not.toHaveBeenCalled();
    await emit(['EVENT', subscription, profile()]);
    await expect(result).resolves.toBe('alice@trustroots.org');
    expect(socket.close).toHaveBeenCalledOnce();
  });

  it('closes after a network timeout', async () => {
    const result = lookupRelayIdentity(pubkey, relay, {});
    await vi.advanceTimersByTimeAsync(5000);
    await expect(result).resolves.toBe('');
    expect(socket.close).toHaveBeenCalledOnce();
  });

  it('does not send an AUTH proof approved after the signing deadline', async () => {
    let approve;
    const result = lookupRelayIdentity(pubkey, relay, { signEvent: () => new Promise((resolve) => { approve = resolve; }) });
    socket.onopen();
    const pending = emit(['AUTH', 'challenge']);
    await vi.advanceTimersByTimeAsync(60000);
    approve({ pubkey, id: 'late' });
    await pending;
    await expect(result).resolves.toBe('');
    expect(socket.sent.some(([type]) => type === 'AUTH')).toBe(false);
  });

  it('rejects an AUTH proof from a switched signer key', async () => {
    const result = lookupRelayIdentity(pubkey, relay, { signEvent: async () => ({ pubkey: 'b'.repeat(64), id: 'wrong-key' }) });
    await emit(['AUTH', 'challenge']);
    await expect(result).resolves.toBe('');
    expect(socket.sent).toHaveLength(0);
  });
});
