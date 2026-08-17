import { hexToNpub, parseNip05Identifier } from './identity.js';

(() => {
  const card = document.querySelector('.sign-in-card');
  const status = document.querySelector('#status');
  const result = document.querySelector('#result');
  const roomTitle = document.querySelector('#room-title');
  const roomDescription = document.querySelector('#room-description');
  const roomPolicy = document.querySelector('#room-policy');
  const roomParticipants = document.querySelector('#room-participants');
  const roomReadonly = document.querySelector('#room-readonly');
  const timeline = document.querySelector('#timeline');
  const timelineStatus = document.querySelector('#timeline-status');
  const timelineRetry = document.querySelector('#timeline-retry');
  const timelineOlder = document.querySelector('#timeline-older');
  const headerIdentity = document.querySelector('#nostr-identity');
  const nostrDialog = document.querySelector('#nostr-info');
  const chatFilter = document.querySelector('#chat-filter');
  const chatSearchStatus = document.querySelector('#chat-search-status');
  const composer = document.querySelector('#chat-composer');
  const messageInput = document.querySelector('#message-input');
  const messageSend = document.querySelector('#message-send');
  const messageExpiry = document.querySelector('#message-expiry option');
  const composerStatus = document.querySelector('#composer-status');
  let verified = null;
  let activeSession = null;
  let activeRoom = 'hitchat';
  let timelineRefreshTimer = null;
  let searchGeneration = 0;
  const joinedParticipants = {};
  const participantRequests = new Set();
  const nostrAvatarRequests = new Map();
  const timelineRefreshInterval = 5000;
  const avatarPalette = ['#2f8876', '#3979a8', '#aa6b28', '#7b68ad', '#3f8f54', '#a55772', '#597286', '#8c6c32'];
  const writableRooms = new Set(['meta', 'test']);

  const rooms = {
    hitchat: { alias: '#hitchat:hitchhiking.org', description: 'Signal and Matrix meet in one two-way community room.', policy: 'Messages are deleted after 28 days.' },
    meta: { alias: '#meta:hitchhiking.org', description: 'group to discuss meta issues, like how to evolve this hitch chat stuff\n\nreclaim "meta" – think meta.wikipedia.org, not evil corp', policy: 'Messages are deleted after 28 days.' },
    test: { alias: '#test:hitchhiking.org', description: 'test room, use for anything', policy: 'Messages without reactions are deleted after 24 hours. A reaction keeps a message for up to 28 days.' },
  };

  const timelines = Object.fromEntries(Object.keys(rooms).map((room) => [room, {
    recent: [], older: [], nextBatch: '', hasMore: false, loaded: false, loading: false, paging: false, error: '',
  }]));

  const roomFromHash = () => {
    const candidate = location.hash.slice(1).toLowerCase();
    return rooms[candidate] ? candidate : 'hitchat';
  };

  const normalizedSearch = () => chatFilter?.value.trim().toLocaleLowerCase() || '';
  const senderLabelFor = (message) => message.nip05 || message.sender;
  const roomMessages = (room) => {
    const byEvent = new Map();
    for (const message of [...timelines[room].older, ...timelines[room].recent]) {
      if (message?.event_id) byEvent.set(message.event_id, message);
    }
    return [...byEvent.values()].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  };

  const messageMatches = (message, query) => {
    if (!query) return true;
    return [senderLabelFor(message), message.sender, message.body].some((value) => String(value || '').toLocaleLowerCase().includes(query));
  };

  const roomMatchDetails = (room, query) => {
    if (!query) return { visible: true, count: 0 };
    const metadata = `${rooms[room].alias}\n${rooms[room].description}`.toLocaleLowerCase().includes(query);
    const count = roomMessages(room).filter((message) => messageMatches(message, query)).length;
    return { visible: metadata || count > 0, count };
  };

  const setStatus = (message, type = '') => { status.textContent = message; status.className = `status ${type}`; };
  const setHeaderIdentity = (label, state = 'missing') => { headerIdentity.textContent = label; headerIdentity.dataset.state = state; };
  const showSignInCard = () => { card.hidden = false; };

  const avatarColorFor = (senderIdentity) => {
    let hash = 2166136261;
    for (const character of senderIdentity.trim().toLocaleLowerCase()) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return avatarPalette[(hash >>> 0) % avatarPalette.length];
  };

  const safeImageURL = (raw) => {
    if (typeof raw !== 'string' || raw.length > 2048) return '';
    try {
      const parsed = new URL(raw, location.origin);
      if (parsed.origin === location.origin || parsed.protocol === 'https:') return parsed.href;
    } catch (_) {}
    return '';
  };

  const resolveNostrAvatar = (pubkey) => {
    const normalized = String(pubkey || '').trim().toLocaleLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) return Promise.resolve('');
    if (nostrAvatarRequests.has(normalized)) return nostrAvatarRequests.get(normalized);
    const request = new Promise((resolve) => {
      let socket;
      let settled = false;
      const subscription = `hitchhiking-avatar-${Math.random().toString(36).slice(2)}`;
      const finish = (value = '') => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { socket?.close(); } catch (_) {}
        resolve(safeImageURL(value));
      };
      const timer = setTimeout(() => finish(), 3500);
      try {
        socket = new WebSocket('wss://relay.trustroots.org');
        socket.onopen = () => socket.send(JSON.stringify(['REQ', subscription, { kinds: [0], authors: [normalized], limit: 1 }]));
        socket.onmessage = ({ data }) => {
          try {
            const message = JSON.parse(data);
            if (message[0] === 'EVENT' && message[1] === subscription) {
              finish(JSON.parse(message[2]?.content || '{}').picture || '');
            } else if (message[0] === 'EOSE' && message[1] === subscription) finish();
          } catch (_) {}
        };
        socket.onerror = () => finish();
      } catch (_) { finish(); }
    });
    nostrAvatarRequests.set(normalized, request);
    return request;
  };

  const addAvatarImage = (avatar, rawURL) => {
    const src = safeImageURL(rawURL);
    if (!src || avatar.querySelector('img')) return;
    const image = document.createElement('img');
    image.className = 'timeline-avatar-image';
    image.alt = '';
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.src = src;
    image.addEventListener('error', () => image.remove(), { once: true });
    avatar.append(image);
  };

  const createAvatar = (message) => {
    const senderLabel = senderLabelFor(message);
    const avatar = document.createElement('span');
    avatar.className = 'timeline-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = senderLabel.replace(/^@/, '').slice(0, 1).toUpperCase() || '?';
    avatar.style.setProperty('--avatar-color', avatarColorFor(senderLabel));
    if (message.avatar_url) addAvatarImage(avatar, message.avatar_url);
    else if (message.nostr_pubkey) resolveNostrAvatar(message.nostr_pubkey).then((url) => {
      if (avatar.isConnected) addAvatarImage(avatar, url);
    });
    return avatar;
  };

  const renderParticipantSummary = (room) => {
    if (room !== activeRoom || !joinedParticipants[room]) return;
    const recentNip05 = new Set(roomMessages(room).map((message) => message.nip05?.toLocaleLowerCase()).filter(Boolean));
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

  const removeOwnMessage = async (message, room, button) => {
    if (!window.confirm('Delete this message?')) return;
    button.disabled = true;
    try {
      await requestJSON('/chat/auth/chat/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, event_id: message.event_id }),
      });
      const state = timelines[room];
      state.recent = state.recent.filter((entry) => entry.event_id !== message.event_id);
      state.older = state.older.filter((entry) => entry.event_id !== message.event_id);
      renderTimeline(room);
      await loadTimeline({ room, silent: true });
    } catch (error) {
      composerStatus.textContent = error.message || 'Message could not be deleted.';
      button.disabled = false;
    }
  };

  const reactToMessage = async (message, room, key, button) => {
    button.disabled = true;
    try {
      await requestJSON('/chat/auth/chat/react', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, event_id: message.event_id, key }),
      });
      await loadTimeline({ room, silent: true });
    } catch (error) {
      composerStatus.textContent = error.message || 'Reaction could not be added.';
      button.disabled = false;
    }
  };

  const createMessageItem = (message, room) => {
    const item = document.createElement('li');
    item.className = 'timeline-message';
    item.dataset.msgtype = message.msgtype;
    const avatar = createAvatar(message);
    const bubble = document.createElement('div');
    bubble.className = 'timeline-bubble';
    const meta = document.createElement('div');
    meta.className = 'timeline-meta';
    const senderLabel = senderLabelFor(message);
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
      const reactionPill = document.createElement(writableRooms.has(room) ? 'button' : 'span');
      reactionPill.className = 'message-reaction';
      reactionPill.textContent = `${reaction.key} ${reaction.count}`;
      if (reactionPill instanceof HTMLButtonElement) {
        reactionPill.type = 'button';
        reactionPill.title = `Add ${reaction.key} reaction`;
        reactionPill.addEventListener('click', () => reactToMessage(message, room, reaction.key, reactionPill));
      }
      reactionList.append(reactionPill);
    }
    if (writableRooms.has(room)) {
      const picker = document.createElement('span');
      picker.className = 'reaction-picker';
      picker.hidden = true;
      for (const key of ['👍', '❤️', '😂', '🎉', '👀', '🙏']) {
        const choice = document.createElement('button');
        choice.type = 'button';
        choice.textContent = key;
        choice.title = `React with ${key}`;
        choice.setAttribute('aria-label', `React with ${key}`);
        choice.addEventListener('click', () => reactToMessage(message, room, key, choice));
        picker.append(choice);
      }
      const addReaction = document.createElement('button');
      addReaction.className = 'message-reaction-add';
      addReaction.type = 'button';
      addReaction.textContent = '+';
      addReaction.title = 'Add a reaction';
      addReaction.setAttribute('aria-label', 'Add a reaction');
      addReaction.setAttribute('aria-expanded', 'false');
      addReaction.addEventListener('click', () => {
        picker.hidden = !picker.hidden;
        addReaction.setAttribute('aria-expanded', String(!picker.hidden));
      });
      reactionList.append(addReaction, picker);
    }
    const footer = document.createElement('div');
    footer.className = 'message-footer';
    if (writableRooms.has(room) && message.nip05 && activeSession?.nip05?.toLocaleLowerCase() === message.nip05.toLocaleLowerCase()) {
      const remove = document.createElement('button');
      remove.className = 'message-delete';
      remove.type = 'button';
      remove.textContent = '🗑';
      remove.title = 'Delete message';
      remove.setAttribute('aria-label', 'Delete your message');
      remove.addEventListener('click', () => removeOwnMessage(message, room, remove));
      footer.append(remove);
    }
    meta.append(sender);
    bubble.append(meta, body);
    if (reactionList.childElementCount) bubble.append(reactionList);
    footer.append(time);
    bubble.append(footer);
    item.append(avatar, bubble);
    return item;
  };

  const renderTimeline = (room, { prepending = false, previousHeight = 0 } = {}) => {
    if (room !== activeRoom) return;
    const state = timelines[room];
    const query = normalizedSearch();
    const messages = roomMessages(room).filter((message) => messageMatches(message, query));
    const wasAtBottom = timeline.scrollHeight - timeline.clientHeight - timeline.scrollTop < 80;
    const previousTop = timeline.scrollTop;
    timeline.replaceChildren(...messages.map((message) => createMessageItem(message, room)));
    if (prepending) timeline.scrollTop = previousTop + Math.max(0, timeline.scrollHeight - previousHeight);
    else if (!query && (wasAtBottom || !state.loaded)) timeline.scrollTop = timeline.scrollHeight;
    else timeline.scrollTop = Math.min(previousTop, timeline.scrollHeight);

    timelineOlder.hidden = !state.hasMore;
    timelineOlder.disabled = state.paging;
    timelineOlder.textContent = state.paging ? 'Loading older messages…' : 'Load older messages';
    timelineRetry.hidden = !state.error;
    if (state.error) {
      timelineStatus.textContent = state.error;
      timelineStatus.className = 'timeline-status error';
    } else if (query) {
      timelineStatus.textContent = `${messages.length} ${messages.length === 1 ? 'match' : 'matches'} in loaded messages${state.hasMore ? ' · load older to search more' : ''}`;
      timelineStatus.className = 'timeline-status search-results';
    } else {
      timelineStatus.textContent = state.loaded && roomMessages(room).length === 0 ? 'No text messages are available.' : '';
      timelineStatus.className = 'timeline-status';
    }
    renderParticipantSummary(room);
  };

  const updateSearchResults = () => {
    const query = normalizedSearch();
    let visibleRooms = 0;
    let totalMatches = 0;
    document.querySelectorAll('.room-item').forEach((item) => {
      const details = roomMatchDetails(item.dataset.room, query);
      item.hidden = !details.visible;
      if (details.visible) visibleRooms += 1;
      totalMatches += details.count;
      const count = item.querySelector('.room-match-count');
      count.textContent = details.count;
      count.hidden = !query || details.count === 0;
    });
    chatSearchStatus.textContent = query ? `${visibleRooms} ${visibleRooms === 1 ? 'chat' : 'chats'} · ${totalMatches} message ${totalMatches === 1 ? 'match' : 'matches'}` : '';
    renderTimeline(activeRoom);
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
    roomPolicy.replaceChildren();
    const policyLabel = document.createElement('strong');
    policyLabel.textContent = 'Deletion: ';
    roomPolicy.append(policyLabel, room.policy);
    const writable = writableRooms.has(activeRoom);
    messageExpiry.textContent = activeRoom === 'test' ? '24h' : '28d';
    messageInput.readOnly = !writable;
    messageSend.disabled = !writable || messageInput.value.trim() === '';
    composer.hidden = !writable;
    roomReadonly.hidden = writable;
    composerStatus.textContent = writable ? 'Enter to send · Shift+Enter for a new line' : '';
    roomParticipants.hidden = true;
    renderParticipantSummary(activeRoom);
    renderTimeline(activeRoom);
    if (activeSession && writable && matchMedia('(min-width: 761px)').matches) messageInput.focus({ preventScroll: true });
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

  const loadTimeline = async ({ room = activeRoom, silent = false, before = '' } = {}) => {
    const state = timelines[room];
    if (state.loading || state.paging) return;
    const prepending = before !== '';
    if (prepending) state.paging = true;
    else state.loading = true;
    state.error = '';
    const previousHeight = room === activeRoom ? timeline.scrollHeight : 0;
    if (!silent && room === activeRoom) {
      timelineStatus.textContent = prepending ? 'Loading older messages…' : 'Loading messages…';
      timelineStatus.className = 'timeline-status';
      timelineRetry.hidden = true;
    }
    try {
      const params = new URLSearchParams({ room });
      if (before) params.set('before', before);
      const data = await requestJSON(`/chat/auth/chat/timeline?${params}`);
      const messages = Array.isArray(data.messages) ? data.messages : [];
      if (prepending) state.older = [...messages, ...state.older];
      else state.recent = messages;
      state.nextBatch = typeof data.next_batch === 'string' ? data.next_batch : '';
      state.hasMore = Boolean(data.has_more && state.nextBatch);
      state.loaded = true;
      renderTimeline(room, { prepending, previousHeight });
      updateSearchResults();
    } catch (error) {
      state.error = error.message || 'Could not load messages.';
      if (!silent) renderTimeline(room);
    } finally {
      state.loading = false;
      state.paging = false;
      if (room === activeRoom) renderTimeline(room);
    }
  };

  const searchLoadedMessages = async () => {
    const generation = ++searchGeneration;
    if (!normalizedSearch() || !activeSession) {
      updateSearchResults();
      return;
    }
    chatSearchStatus.textContent = 'Searching loaded messages…';
    await Promise.all(Object.keys(rooms).map((room) => timelines[room].loaded ? Promise.resolve() : loadTimeline({ room, silent: true })));
    if (generation === searchGeneration) updateSearchResults();
  };

  const startTimelineRefresh = () => {
    if (timelineRefreshTimer !== null) clearInterval(timelineRefreshTimer);
    timelineRefreshTimer = setInterval(() => {
      if (activeSession && !document.hidden) loadTimeline({ room: activeRoom, silent: true });
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
    if (!writableRooms.has(activeRoom) || body === '') return;
    const room = activeRoom;
    messageInput.readOnly = true;
    messageSend.disabled = true;
    composerStatus.textContent = 'sending…';
    try {
      await requestJSON('/chat/auth/chat/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, body }),
      });
      messageInput.value = '';
      composerStatus.textContent = 'sent';
      await loadTimeline({ room });
    } catch (error) {
      composerStatus.textContent = error.message || 'Message could not be sent.';
    } finally {
      messageInput.readOnly = !writableRooms.has(activeRoom);
      messageSend.disabled = !writableRooms.has(activeRoom) || messageInput.value.trim() === '';
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
    if (String(event?.pubkey || '').toLocaleLowerCase() !== pubkey) throw new Error('The authorization was signed by a different key.');
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
  timelineRetry.addEventListener('click', () => loadTimeline({ room: activeRoom }));
  timelineOlder.addEventListener('click', () => {
    const state = timelines[activeRoom];
    if (state.hasMore && state.nextBatch) loadTimeline({ room: activeRoom, before: state.nextBatch });
  });
  chatFilter?.addEventListener('input', searchLoadedMessages);
  messageInput.addEventListener('input', () => {
    messageSend.disabled = !writableRooms.has(activeRoom) || messageInput.value.trim() === '';
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
      loadTimeline({ room: activeRoom });
      loadParticipants();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (activeSession && !document.hidden) loadTimeline({ room: activeRoom, silent: true });
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
