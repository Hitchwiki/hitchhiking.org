import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('../chat/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../chat/chat.js', import.meta.url), 'utf8');
const sharedIdentity = readFileSync(new URL('../assets/nostr-identity.js', import.meta.url), 'utf8');
const landingPage = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const aboutPage = readFileSync(new URL('../about/index.html', import.meta.url), 'utf8');

describe('authenticated Hitchat timeline', () => {
  it('uses the compact landing-page scale', () => {
    expect(page).toContain('<html lang="en" class="compact-ui">');
  });

  it('keeps the timeline inside the initially hidden authenticated room card', () => {
    expect(page).toMatch(/<section id="result"[^>]*hidden>[\s\S]*id="timeline"/);
  });

  it('checks the session before requesting messages', () => {
    expect(script.indexOf("requestJSON('/chat/auth/chat/session')")).toBeLessThan(script.lastIndexOf('showRoom(await'));
    expect(script).toContain('requestJSON(`/chat/auth/chat/timeline?room=${encodeURIComponent(activeRoom)}`)');
    expect(page).toContain('href="/chat/#meta"');
    expect(page).toContain('href="/chat/#test"');
  });

  it('renders Matrix-controlled sender and body values as text', () => {
    expect(script).toContain('sender.textContent = message.sender');
    expect(script).toContain("body.textContent = message.msgtype === 'm.emote'");
    expect(script).toContain("avatar.textContent = message.sender.replace(/^@/, '')");
    expect(script).not.toContain('innerHTML');
  });

  it('uses NIP-07 automatically without connection-choice UI', () => {
    expect(page).toContain('/assets/nostr-identity.js');
    expect(sharedIdentity).toContain("new CustomEvent('hitchhiking:nostr-identity'");
    expect(script).toContain("window.addEventListener('hitchhiking:nostr-identity'");
    expect(sharedIdentity).toContain('window.hitchhikingNostrIdentity = { pubkey, nip05: handle }');
    expect(script).toContain('if (window.hitchhikingNostrIdentity) authorizeResolvedIdentity');
    expect(page).toContain('https://nos.trustroots.org/');
    expect(page).not.toContain('id="nip07"');
    expect(page).not.toContain('nip46');
    expect(page).not.toContain('NIP-46');
  });

  it('never renders raw hexadecimal signer keys', () => {
    expect(sharedIdentity).toContain("import { hexToNpub } from './nostr-key.js'");
    expect(sharedIdentity).toContain('`Nostr: ${hexToNpub(pubkey)}`');
    expect(sharedIdentity).not.toContain('pubkey.slice(');
    for (const html of [landingPage, aboutPage, page]) {
      expect(html).toContain('type="module"');
      expect(html).toContain('nostr-identity.js?v=20260808-6');
    }
  });

  it('keeps a verified Nostr identity when chat authorization fails later', () => {
    expect(script).toContain("setHeaderIdentity(`Nostr: ${nip05}`, 'connected')");
    expect(script).toContain("if (!verified) setHeaderIdentity('Nostr: identity check failed', 'unlinked')");
  });

  it('enables sending only for the internal Test room', () => {
    expect(page).toContain('id="chat-composer"');
    expect(script).toContain("activeRoom === 'test'");
    expect(script).toContain("requestJSON('/chat/auth/chat/send'");
    expect(script).toContain("JSON.stringify({ room: 'test', body })");
  });
});
