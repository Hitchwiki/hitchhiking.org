import { hexToNpub, parseNip05Identifier } from './identity.js';

(() => {
  const card = document.querySelector('.sign-in-card');
  const status = document.querySelector('#status');
  const result = document.querySelector('#result');
  const roomTitle = document.querySelector('#room-title');
  const roomDescription = document.querySelector('#room-description');
  const roomParticipants = document.querySelector('#room-participants');
  const timeline = document.querySelector('#timeline');
  const timelineStatus = document.querySelector('#timeline-status');
  const timelineRetry = document.querySelector('#timeline-retry');
  const headerIdentity = document.querySelector('#nostr-identity');
  const nostrDialog = document.querySelector('#nostr-info');
  const chatFilter = document.querySelector('#chat-filter');
  const composer = document.querySelector('#chat-composer');
  const messageInput = document.querySelector('#message-input');
  const messageSend = document.querySelector('#message-send');
  const messageExpiry = document.querySelector('#message-expiry option');
  const composerStatus = document.querySelector('#composer-status');
  let verified = null;
  let activeSession = null;
  let activeRoom = 'hitchat';
  let timelineLoading = false;
  let timelineRefreshPending = false;
  let timelineRefreshTimer = null;
  let renderedRoom = '';
  let renderedTimelineKey = '';
  const joinedParticipants = {};
  const recentRoomMessages = {};
  const participantRequests = new Set();
  const timelineRefreshInterval = 5000;
  const avatarPalette = ['#2f8876', '#3979a8', '#aa6b28', '#7b68ad', '#3f8f54', '#a55772', '#597286', '#8c6c32'];

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
    messageExpiry.textContent = writable ? '24h' : '28d';
    messageInput.readOnly = !writable;
    messageSend.disabled = !writable || messageInput.value.trim() === '';
    composerStatus.textContent = writable ? 'press Enter to send · Shift+Enter for a new line' : 'read-only';
    if (activeSession && writable) messageInput.focus();
    roomParticipants.hidden = true;
    renderParticipantSummary(activeRoom);
  };

  const setStatus = (message, type = '') => { status.textContent = message; status.className = `status ${type}`; };
  const setHeaderIdentity = (label, state = 'missing') => { headerIdentity.textContent = label; headerIdentity.dataset.state = state; };
  const showSignInCard = () => { card.hidden = false; };

  const avatarColorFor = (senderIdentity) => {
    let hash = 2166136261;
    for (const character of senderIdentity.trim().toLowerCase()) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return avatarPalette[(hash >>> 0) % avatarPalette.length];
  };

  const renderParticipantSummary = (room) => {
    if (room !== activeRoom || !joinedParticipants[room]) return;
    const recentNip05 = new Set((recentRoomMessages[room] || []).map((message) => message.nip05?.toLowerCase()).filter(Boolean));
    const counts = [
      ['Matrix', joinedParticipants[room].matrix],
      ...(Number.isInteger(joinedParticipants[room].signal) ? [['Signal', joinedParticipants[room].signal]] : []),
      ['NIP-05', recentNip05.size],
    ];
    roomParticipants.replaceChildren(...counts.map(([label, count]) => {
      const item = document.createElement('span');
      item.className = 'participant-count';
      item.textContent = `${label} ${count}`;
      return item;
    }));
    roomParticipants.hidden = false;
  };

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

  const renderTimeline = (messages, room) => {
    recentRoomMessages[room] = messages;
    renderParticipantSummary(room);
    const timelineKey = messages.map((message) => `${message.event_id}:${(message.reactions || []).map((reaction) => `${reaction.key}:${reaction.count}`).join(',')}`).join('\n');
    if (renderedRoom === room && renderedTimelineKey === timelineKey) return;
    renderedRoom = room;
    renderedTimelineKey = timelineKey;
    timeline.replaceChildren();
    for (const message of messages) {
      const item = document.createElement('li');
      item.className = 'timeline-message';
      item.dataset.msgtype = message.msgtype;
      const avatar = document.createElement('span');
      avatar.className = 'timeline-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      const senderLabel = message.nip05 || message.sender;
      avatar.textContent = senderLabel.replace(/^@/, '').slice(0, 1).toUpperCase() || '?';
      avatar.style.setProperty('--avatar-color', avatarColorFor(senderLabel));
      const bubble = document.createElement('div');
      bubble.className = 'timeline-bubble';
      const meta = document.createElement('div');
      meta.className = 'timeline-meta';
      const sender = document.createElement(message.profile_url ? 'a' : 'span');
      sender.className = 'timeline-sender';
      sender.textContent = senderLabel;
      if (message.profile_url) {
        sender.href = message.profile_url;
        sender.rel = 'noopener noreferrer';
        sender.target = '_blank';
      }
      const time = document.createElement('time');
      time.className = 'timeline-time';
      time.dateTime = new Date(message.timestamp).toISOString();
      time.textContent = new Date(message.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      const body = document.createElement('p');
      body.className = 'timeline-body';
      body.textContent = message.msgtype === 'm.emote' ? `* ${message.sender} ${message.body}` : message.body;
      const reactionList = document.createElement('div');
      reactionList.className = 'message-reactions';
      reactionList.setAttribute('aria-label', 'Message reactions');
      for (const reaction of Array.isArray(message.reactions) ? message.reactions : []) {
        if (typeof reaction.key !== 'string' || !Number.isInteger(reaction.count) || reaction.count < 1) continue;
        const reactionPill = document.createElement('span');
        reactionPill.className = 'message-reaction';
        reactionPill.textContent = `${reaction.key} ${reaction.count}`;
        reactionList.append(reactionPill);
      }
      const copy = document.createElement('button');
      copy.className = 'message-copy';
      copy.type = 'button';
      copy.title = 'Copy message';
      copy.setAttribute('aria-label', `Copy message from ${message.sender}`);
      copy.textContent = '⧉';
      copy.addEventListener('click', async () => {
        await navigator.clipboard?.writeText(message.body);
      });
      const actions = document.createElement('div');
      actions.className = 'message-actions';
      actions.append(copy);
      if (message.nip05 && activeSession?.nip05 === message.nip05) {
        const remove = document.createElement('button');
        remove.className = 'message-delete';
        remove.type = 'button';
        remove.textContent = '🗑';
        remove.title = 'Delete message';
        remove.setAttribute('aria-label', 'Delete your message');
        remove.addEventListener('click', async () => {
          if (!window.confirm('Delete this message?')) return;
          remove.disabled = true;
          try {
            await requestJSON('/chat/auth/chat/delete', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ room: 'test', event_id: message.event_id }),
            });
            await loadTimeline();
          } catch (error) {
            composerStatus.textContent = error.message || 'Message could not be deleted.';
            remove.disabled = false;
          }
        });
        actions.append(remove);
      }
      meta.append(sender);
      bubble.append(meta, body);
      if (reactionList.childElementCount) bubble.append(reactionList);
      bubble.append(time);
      item.append(avatar, bubble, actions);
      timeline.append(item);
    }
    timeline.scrollTop = timeline.scrollHeight;
  };

  const loadParticipants = async (room = activeRoom) => {
    if (participantRequests.has(room)) return;
    participantRequests.add(room);
    try {
      const data = await requestJSON(`/chat/auth/chat/participants?room=${encodeURIComponent(room)}`);
      if (data.participants && Number.isInteger(data.participants.matrix)) {
        joinedParticipants[room] = data.participants;
        renderParticipantSummary(room);
      }
    } catch {
      // Participant counts are supplementary; timeline errors are handled separately.
    } finally {
      participantRequests.delete(room);
    }
  };

  const loadTimeline = async ({ silent = false } = {}) => {
    if (timelineLoading) {
      timelineRefreshPending = true;
      return;
    }
    timelineLoading = true;
    const requestedRoom = activeRoom;
    if (!silent) {
      timelineStatus.textContent = 'Loading messages…';
      timelineStatus.className = 'timeline-status';
      timelineRetry.hidden = true;
    }
    try {
      const data = await requestJSON(`/chat/auth/chat/timeline?room=${encodeURIComponent(requestedRoom)}`);
      if (requestedRoom !== activeRoom) return;
      const messages = Array.isArray(data.messages) ? data.messages : [];
      renderTimeline(messages, requestedRoom);
      timelineStatus.textContent = messages.length ? '' : 'No recent text messages are available.';
      timelineStatus.className = 'timeline-status';
      timelineRetry.hidden = true;
    } catch (error) {
      if (!silent) {
        timelineStatus.textContent = error.message || 'Could not load recent messages.';
        timelineStatus.className = 'timeline-status error';
        timelineRetry.hidden = false;
      }
    } finally {
      timelineLoading = false;
      if (timelineRefreshPending) {
        timelineRefreshPending = false;
        loadTimeline({ silent: true });
      }
    }
  };

  const startTimelineRefresh = () => {
    if (timelineRefreshTimer !== null) clearInterval(timelineRefreshTimer);
    timelineRefreshTimer = setInterval(() => {
      if (activeSession && !document.hidden) loadTimeline({ silent: true });
    }, timelineRefreshInterval);
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
    loadParticipants();
    startTimelineRefresh();
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
        showSignInCard();
        setHeaderIdentity(`Nostr: ${hexToNpub(pubkey).slice(0, 16)}…`, 'unlinked');
        setStatus('This signer does not have a Trustroots or Hitchwiki NIP-05 identity yet.', 'error');
        return;
      }
      prepareNip05(nip05);
      setHeaderIdentity(`Nostr: ${nip05}`, 'connected');
      setStatus(`Verified ${nip05}. Authorizing chat access…`, 'success');
      await authorizeAndShowRoom(pubkey);
    } catch (error) {
      showSignInCard();
      if (!verified) setHeaderIdentity('Nostr: identity check failed', 'unlinked');
      setStatus(error.message, 'error');
    }
  };

  document.querySelector('[data-close-nostr-dialog]').addEventListener('click', () => nostrDialog.close());
  window.addEventListener('hitchhiking:nostr-identity', (event) => authorizeResolvedIdentity(event.detail));
  window.addEventListener('hitchhiking:nostr-unavailable', showSignInCard);
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
    if (activeSession) {
      loadTimeline();
      loadParticipants();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (activeSession && !document.hidden) loadTimeline({ silent: true });
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
