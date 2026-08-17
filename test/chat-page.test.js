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
    expect(script).toContain('requestJSON(`/chat/auth/chat/timeline?${params}`)');
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

  it('renders reaction counts and offers compact reactions in writable rooms', () => {
    expect(script).toContain("reactionList.setAttribute('aria-label', 'Message reactions')");
    expect(script).toContain('reactionPill.textContent = `${reaction.key} ${reaction.count}`');
    expect(script).toContain("requestJSON('/chat/auth/chat/react'");
    expect(script).toContain("for (const key of ['👍', '❤️', '😂', '🎉', '👀', '🙏'])");
    expect(script).toContain("reactionPill.classList.toggle('mine', reaction.mine === true)");
    expect(script).toContain('reaction.mine ? `Remove your ${reaction.key} reaction`');
    expect(script).toContain('closeReactionPickers(opening ? picker : null)');
    expect(styles).toMatch(/\.reaction-picker \{[\s\S]*?position: absolute/);
    expect(styles).toContain('.message-reaction.mine');
    expect(styles).toContain('.message-reaction');
    expect(script).not.toContain('innerHTML');
  });

  it('documents both Meta discussion paths on About', () => {
    expect(aboutPage).toContain('href="/chat/#meta"');
    expect(aboutPage).toContain('https://matrix.to/#/#meta:hitchhiking.org');
    expect(aboutPage).toContain('technical and organizational matters');
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

  it('enables sending in Meta and Test while keeping Hitchat clearly read-only', () => {
    expect(page).toContain('id="chat-composer"');
    expect(page).toContain('<strong>#hitchat is read-only here.</strong>');
    expect(script).toContain("const writableRooms = new Set(['meta', 'test'])");
    expect(script).toContain("activeRoom === 'test'");
    expect(script).toContain("requestJSON('/chat/auth/chat/send'");
    expect(script).toContain('JSON.stringify({ room, body })');
    expect(page).toContain('<option>24h</option>');
    expect(script).toContain("messageExpiry.textContent = activeRoom === 'test' ? '24h' : '28d'");
  });

  it('offers deletion only for the signed-in NIP-05 author', () => {
    expect(script).toContain("activeSession?.nip05?.toLocaleLowerCase() === message.nip05.toLocaleLowerCase()");
    expect(script).toContain("requestJSON('/chat/auth/chat/delete'");
    expect(script).toContain('JSON.stringify({ room, event_id: message.event_id })');
    expect(script).toContain("remove.textContent = '🗑'");
    expect(script).toContain("remove.setAttribute('aria-label', 'Delete your message')");
    expect(script.indexOf('footer.append(time)')).toBeLessThan(script.indexOf('footer.append(remove)'));
    expect(styles).toContain('.message-footer .timeline-time');
  });

  it('uses a stable compact timestamp format', () => {
    expect(script).toContain("return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`");
    expect(script).toContain('time.textContent = formatTimestamp(message.timestamp)');
  });

  it('shows timeline status without shifting messages', () => {
    expect(page).toContain('<div class="timeline-wrap">');
    expect(styles).toMatch(/\.timeline-wrap \.timeline-status \{[\s\S]*?position: absolute/);
    expect(styles).toMatch(/\.timeline-wrap \{[\s\S]*?flex: 1/);
  });

  it('focuses the composer only when an authenticated room is writable', () => {
    expect(script).toContain("if (activeSession && writable && matchMedia('(min-width: 761px)').matches) messageInput.focus({ preventScroll: true })");
    expect(script.indexOf('messageInput.readOnly = !writable')).toBeLessThan(script.indexOf("if (activeSession && writable && matchMedia('(min-width: 761px)').matches)"));
  });

  it('uses dynamic mobile height and prevents iPhone form focus zoom', () => {
    expect(styles).toContain('height: 100dvh');
    expect(styles).toContain('grid-template-rows: auto minmax(0, 1fr)');
    expect(styles).toMatch(/\.chat-search input \{[\s\S]*?font-size: 16px/);
    expect(styles).toMatch(/\.chat-composer textarea \{[\s\S]*?font-size: 16px/);
    expect(styles).toMatch(/\.composer-expiry select \{[\s\S]*?font-size: 16px/);
  });

  it('shows deletion policy beside the room description', () => {
    expect(page).toContain('id="room-policy"');
    expect(script).toContain('Messages without reactions are deleted after 24 hours. A reaction keeps a message for up to 28 days.');
    expect(aboutPage).toContain('messages without reactions are deleted after 24 hours');
  });

  it('searches loaded message bodies and paginates with the opaque cursor', () => {
    expect(page).toContain('placeholder="Search chats and messages"');
    expect(script).toContain('[senderLabelFor(message), message.sender, message.body]');
    expect(script).toContain("params.set('before', before)");
    expect(script).toContain('timeline.scrollHeight - previousHeight');
  });

  it('does not render a copy button on messages', () => {
    expect(script).not.toContain('message-copy');
    expect(page).not.toContain('Copy message');
  });

  it('starts directly with room messages without a timeline heading', () => {
    expect(page).not.toContain('Recent messages');
  });

  it('refreshes authenticated room timelines while the page is visible', () => {
    expect(script).toContain('const timelineRefreshInterval = 5000');
    expect(script).toContain('setInterval(() =>');
    expect(script).toContain("loadTimeline({ room: activeRoom, silent: true })");
    expect(script).toContain("document.addEventListener('visibilitychange'");
    expect(script).toContain('state.recent = messages');
  });
});
