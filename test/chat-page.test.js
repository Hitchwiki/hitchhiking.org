import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('../chat/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../chat/chat.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../chat/chat.css', import.meta.url), 'utf8');
const sharedIdentity = readFileSync(new URL('../assets/nostr-identity.js', import.meta.url), 'utf8');
const landingPage = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const aboutPage = readFileSync(new URL('../about/index.html', import.meta.url), 'utf8');

describe('authenticated Hitchat timeline', () => {
  it('uses the compact landing-page scale', () => {
    expect(page).toContain('<html lang="en" class="compact-ui">');
    expect(aboutPage).toContain('<html lang="en" class="compact-ui">');
  });

  it('links Hitchwiki Maps from every public page header', () => {
    for (const html of [landingPage, aboutPage, page]) {
      expect(html).toContain('<a href="https://maps.hitchwiki.org/">Maps</a>');
    }
  });

  it('keeps first-party Umami analytics on chat and About', () => {
    for (const html of [page, aboutPage]) {
      expect(html).toContain('https://1p.hitchhiking.org/script.js');
      expect(html).toContain('data-website-id="166e3735-3228-4608-b43a-92761a55499e"');
    }
  });

  it('keeps the timeline inside the initially hidden authenticated room card', () => {
    expect(page).toMatch(/<section id="result"[^>]*hidden>[\s\S]*id="timeline"/);
    expect(page).toMatch(/<section class="sign-in-card"[^>]*hidden>/);
    expect(script).toContain("window.addEventListener('hitchhiking:nostr-unavailable', showSignInCard)");
    expect(sharedIdentity).toContain("new CustomEvent('hitchhiking:nostr-unavailable')");
  });

  it('checks the session before requesting messages', () => {
    expect(script.indexOf("requestJSON('/chat/auth/chat/session')")).toBeLessThan(script.lastIndexOf('showRoom(await'));
    expect(script).toContain('requestJSON(`/chat/auth/chat/timeline?room=${encodeURIComponent(requestedRoom)}`)');
    expect(page).toContain('href="/chat/#meta"');
    expect(page).toContain('href="/chat/#test"');
  });

  it('renders Matrix-controlled sender and body values as text', () => {
    expect(script).toContain('sender.textContent = senderLabel');
    expect(script).toContain("body.textContent = message.msgtype === 'm.emote'");
    expect(script).toContain("avatar.textContent = senderLabel.replace(/^@/, '')");
    expect(script).toContain("document.createElement(message.profile_url ? 'a' : 'span')");
    expect(script).not.toContain('innerHTML');
  });

  it('shows selected-room Matrix, bridged Signal, and recent NIP-05 participant counts', () => {
    expect(page).toContain('id="room-participants"');
    expect(script).toContain('/chat/auth/chat/participants?room=');
    expect(script).toContain("['Matrix', joinedParticipants[room].matrix]");
    expect(script).toContain("['Signal', joinedParticipants[room].signal]");
    expect(script).toContain("['NIP-05', recentNip05.size]");
  });

  it('uses a stable sender-derived avatar color instead of message position', () => {
    expect(script).toContain('const avatarColorFor = (senderIdentity) =>');
    expect(script).toContain("avatar.style.setProperty('--avatar-color', avatarColorFor(senderLabel))");
    expect(styles).toContain('background:var(--avatar-color,#54a8cf)');
    expect(styles).not.toContain('.timeline-message:nth-child');
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
      expect(html).toContain('nostr-identity.js?v=20260808-7');
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
    expect(page).toContain('<option>24h</option>');
    expect(script).toContain("messageExpiry.textContent = writable ? '24h' : '28d'");
  });

  it('offers deletion only for the signed-in NIP-05 author', () => {
    expect(script).toContain('activeSession?.nip05 === message.nip05');
    expect(script).toContain("requestJSON('/chat/auth/chat/delete'");
    expect(script).toContain("JSON.stringify({ room: 'test', event_id: message.event_id })");
  });

  it('focuses the composer only when an authenticated room is writable', () => {
    expect(script).toContain('if (activeSession && writable) messageInput.focus()');
    expect(script.indexOf('messageInput.readOnly = !writable')).toBeLessThan(script.indexOf('if (activeSession && writable) messageInput.focus()'));
  });

  it('does not push the chat below a viewport-height sidebar on mobile', () => {
    expect(styles).toMatch(/@media \(max-width:760px\)[\s\S]*?\.chat-sidebar \{ position:static; height:auto;/);
    expect(styles).toContain('height:calc(100vh - 5.5rem)');
    expect(styles).toContain('grid-template-rows:auto minmax(0,1fr)');
  });

  it('starts directly with room messages without a timeline heading', () => {
    expect(page).not.toContain('Recent messages');
  });

  it('refreshes authenticated room timelines while the page is visible', () => {
    expect(script).toContain('const timelineRefreshInterval = 5000');
    expect(script).toContain('setInterval(() =>');
    expect(script).toContain("loadTimeline({ silent: true })");
    expect(script).toContain("document.addEventListener('visibilitychange'");
    expect(script).toContain('messages.map((message) => message.event_id)');
  });
});
