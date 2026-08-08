import { hexToNpub, parseNip05Identifier } from './identity.js';

(() => {
  const card = document.querySelector('.sign-in-card');
  const status = document.querySelector('#status');
  const result = document.querySelector('#result');
  const roomTitle = document.querySelector('#room-title');
  const roomDescription = document.querySelector('#room-description');
  const timeline = document.querySelector('#timeline');
  const timelineStatus = document.querySelector('#timeline-status');
  const timelineRetry = document.querySelector('#timeline-retry');
  const headerIdentity = document.querySelector('#nostr-identity');
  const nostrDialog = document.querySelector('#nostr-info');
  const chatFilter = document.querySelector('#chat-filter');
  const composer = document.querySelector('#chat-composer');
  const messageInput = document.querySelector('#message-input');
  const messageSend = document.querySelector('#message-send');
  const composerStatus = document.querySelector('#composer-status');
  let verified = null;
  let activeSession = null;
  let activeRoom = 'hitchat';

  const rooms = {
    hitchat: { alias: '#hitchat:hitchhiking.org', description: 'Signal and Matrix meet in one two-way community room.' },
    meta: { alias: '#meta:hitchhiking.org', description: 'group to discuss meta issues, like how to evolve this hitch chat stuff\n\nreclaim "meta" - think meta.wikipedia.org, not evil corp' },
    test: { alias: '#test:hitchhiking.org', description: 'test room, use for anything' },
  };

  const roomFromHash = () => {
    const candidate = location.hash.slice(1).toLowerCase();
    return rooms[candidate] ? candidate : 'hitchat';
  };

  const syncRoomNavigation = () => {
    activeRoom = roomFromHash();
    document.querySelectorAll('.room-item').forEach((item) => {
      const selected = item.dataset.room === activeRoom;
      item.classList.toggle('selected', selected);
      if (selected) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    const room = rooms[activeRoom];
    roomTitle.textContent = room.alias;
    roomDescription.textContent = room.description;
    const writable = activeRoom === 'test';
    messageInput.readOnly = !writable;
    messageSend.disabled = !writable || messageInput.value.trim() === '';
    composerStatus.textContent = writable ? 'press Enter to send · Shift+Enter for a new line' : 'read-only';
  };

  const setStatus = (message, type = '') => { status.textContent = message; status.className = `status ${type}`; };
  const setHeaderIdentity = (label, state = 'missing') => { headerIdentity.textContent = label; headerIdentity.dataset.state = state; };

  const requestJSON = async (url, options = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let response;
    try {
      response = await fetch(url, { credentials: 'same-origin', ...options, signal: controller.signal });
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The chat authorization service timed out.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || 'The chat authorization service is unavailable.');
      error.status = response.status;
      throw error;
    }
    return data;
  };

  const renderTimeline = (messages) => {
    timeline.replaceChildren();
    for (const message of messages) {
      const item = document.createElement('li');
      item.className = 'timeline-message';
      item.dataset.msgtype = message.msgtype;
      const avatar = document.createElement('span');
      avatar.className = 'timeline-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = message.sender.replace(/^@/, '').slice(0, 1).toUpperCase() || '?';
      const bubble = document.createElement('div');
      bubble.className = 'timeline-bubble';
      const meta = document.createElement('div');
      meta.className = 'timeline-meta';
      const sender = document.createElement('span');
      sender.className = 'timeline-sender';
      sender.textContent = message.sender;
      const time = document.createElement('time');
      time.className = 'timeline-time';
      time.dateTime = new Date(message.timestamp).toISOString();
      time.textContent = new Date(message.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      const body = document.createElement('p');
      body.className = 'timeline-body';
      body.textContent = message.msgtype === 'm.emote' ? `* ${message.sender} ${message.body}` : message.body;
      const copy = document.createElement('button');
      copy.className = 'message-copy';
      copy.type = 'button';
      copy.title = 'Copy message';
      copy.setAttribute('aria-label', `Copy message from ${message.sender}`);
      copy.textContent = '⧉';
      copy.addEventListener('click', async () => {
        await navigator.clipboard?.writeText(message.body);
      });
      meta.append(sender);
      bubble.append(meta, body, time);
      item.append(avatar, bubble, copy);
      timeline.append(item);
    }
    timeline.scrollTop = timeline.scrollHeight;
  };

  const loadTimeline = async () => {
    timelineStatus.textContent = 'Loading recent messages…';
    timelineStatus.className = 'timeline-status';
    timelineRetry.hidden = true;
    try {
      const data = await requestJSON(`/chat/auth/chat/timeline?room=${encodeURIComponent(activeRoom)}`);
      const messages = Array.isArray(data.messages) ? data.messages : [];
      renderTimeline(messages);
      timelineStatus.textContent = messages.length ? '' : 'No recent text messages are available.';
    } catch (error) {
      timelineStatus.textContent = error.message || 'Could not load recent messages.';
      timelineStatus.className = 'timeline-status error';
      timelineRetry.hidden = false;
    }
  };

  const showRoom = (session) => {
    activeSession = session;
    syncRoomNavigation();
    const nip05 = session.nip05;
    result.hidden = false;
    card.hidden = true;
    document.body.classList.add('chat-authenticated');
    setHeaderIdentity(`Nostr: ${nip05}`, 'connected');
    loadTimeline();
  };

  const sendMessage = async () => {
    const body = messageInput.value.trim();
    if (activeRoom !== 'test' || body === '') return;
    messageInput.readOnly = true;
    messageSend.disabled = true;
    composerStatus.textContent = 'sending…';
    try {
      await requestJSON('/chat/auth/chat/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: 'test', body }),
      });
      messageInput.value = '';
      composerStatus.textContent = 'sent';
      await loadTimeline();
    } catch (error) {
      composerStatus.textContent = error.message || 'Message could not be sent.';
    } finally {
      messageInput.readOnly = activeRoom !== 'test';
      messageSend.disabled = activeRoom !== 'test' || messageInput.value.trim() === '';
    }
  };

  const prepareNip05 = (identifier) => {
    const identity = parseNip05Identifier(identifier);
    verified = identity;
    setStatus(`Found ${identity.identifier}.`, 'success');
  };

  const authorizeAndShowRoom = async (pubkey) => {
    if (!window.nostr?.signEvent) throw new Error('Your NIP-07 signer cannot create an authorization proof.');
    const endpoint = `${location.origin}/chat/auth/chat/verify`;
    const challenge = await requestJSON('/chat/auth/login/trustroots/challenge');
    setStatus('Approve the private-key authorization check…');
    const event = await window.nostr.signEvent({
      kind: 27235,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['u', endpoint], ['method', 'POST'], ['challenge', challenge.challenge]],
      content: '',
    });
    if (String(event?.pubkey || '').toLowerCase() !== pubkey) throw new Error('The authorization was signed by a different key.');
    await requestJSON('/chat/auth/chat/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_id: challenge.challenge_id, nip05: verified.identifier, event }),
    });
    const session = await requestJSON('/chat/auth/chat/session');
    showRoom(session);
  };

  const authorizeResolvedIdentity = async ({ pubkey, nip05 }) => {
    try {
      if (!['trustroots.org', 'hitchwiki.org'].some((domain) => nip05.endsWith(`@${domain}`))) {
        setHeaderIdentity(`Nostr: ${hexToNpub(pubkey).slice(0, 16)}…`, 'unlinked');
        setStatus('This signer does not have a Trustroots or Hitchwiki NIP-05 identity yet.', 'error');
        return;
      }
      prepareNip05(nip05);
      setHeaderIdentity(`Nostr: ${nip05}`, 'connected');
      setStatus(`Verified ${nip05}. Authorizing chat access…`, 'success');
      await authorizeAndShowRoom(pubkey);
    } catch (error) {
      if (!verified) setHeaderIdentity('Nostr: identity check failed', 'unlinked');
      setStatus(error.message, 'error');
    }
  };

  document.querySelector('[data-close-nostr-dialog]').addEventListener('click', () => nostrDialog.close());
  window.addEventListener('hitchhiking:nostr-identity', (event) => authorizeResolvedIdentity(event.detail));
  if (window.hitchhikingNostrIdentity) authorizeResolvedIdentity(window.hitchhikingNostrIdentity);
  timelineRetry.addEventListener('click', loadTimeline);
  chatFilter?.addEventListener('input', () => {
    const query = chatFilter.value.trim().toLowerCase();
    document.querySelectorAll('.room-item').forEach((room) => {
      room.hidden = query !== '' && !room.textContent.toLowerCase().includes(query);
    });
  });
  messageInput.addEventListener('input', () => {
    messageSend.disabled = activeRoom !== 'test' || messageInput.value.trim() === '';
  });
  messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      composer.requestSubmit();
    }
  });
  composer.addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage();
  });
  window.addEventListener('hashchange', () => {
    syncRoomNavigation();
    if (activeSession) loadTimeline();
  });
  const initialize = async () => {
    try {
      showRoom(await requestJSON('/chat/auth/chat/session'));
    } catch (error) {
      if (error.status !== 401) setStatus(error.message, 'error');
      // The shared identity script used by hitchhiking.org/ dispatches the identity event.
    }
  };
  syncRoomNavigation();
  initialize();
})();
