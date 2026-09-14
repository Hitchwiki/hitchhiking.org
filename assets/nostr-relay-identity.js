const handleFor = (event) => {
  try {
    const nip05 = JSON.parse(event.content || '{}').nip05;
    if (typeof nip05 === 'string' && /^[a-z0-9_.-]+@(trustroots|hitchwiki)\.org$/i.test(nip05)) return nip05.toLowerCase();
  } catch (_) {}
  const tag = (event.tags || []).find((item) => item[0] === 'trustroots' || (item[0] === 'l' && item[2] === 'org.trustroots:username'));
  return tag?.[1] && /^[a-z0-9_.-]+$/i.test(tag[1]) ? `${tag[1].toLowerCase()}@trustroots.org` : '';
};

export const lookupRelayIdentity = (pubkey, relay, signer) => new Promise((resolve) => {
  let socket;
  let done = false;
  let authPending = false;
  let authID = '';
  let timer;
  const subscription = `identity-${Math.random().toString(36).slice(2)}`;
  const finish = (identity = '') => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    try { socket?.close(); } catch (_) {}
    resolve(identity);
  };
  const deadline = (ms) => { clearTimeout(timer); timer = setTimeout(finish, ms); };
  const subscribe = () => socket.send(JSON.stringify(['REQ', subscription, { kinds: [0, 10390], authors: [pubkey], limit: 10 }]));
  try { socket = new WebSocket(relay); } catch (_) { finish(); return; }
  deadline(5000);
  socket.onopen = subscribe;
  socket.onerror = () => finish();
  socket.onclose = () => finish();
  socket.onmessage = async ({ data }) => {
    if (done) return;
    try {
      const message = JSON.parse(data);
      if (message[0] === 'AUTH') {
        if (authPending || authID || typeof message[1] !== 'string') return;
        if (!signer?.signEvent) return finish();
        authPending = true;
        deadline(60000);
        const event = await signer.signEvent({ kind: 22242, created_at: Math.floor(Date.now() / 1000), tags: [['relay', relay], ['challenge', message[1]]], content: '' });
        if (done) return;
        if (event?.pubkey?.toLowerCase() !== pubkey || !event.id) return finish();
        authID = event.id;
        socket.send(JSON.stringify(['AUTH', event]));
        deadline(5000);
      } else if (message[0] === 'OK' && authID && message[1] === authID) {
        if (message[2] !== true) return finish();
        if (!authPending) return;
        authPending = false;
        subscribe();
        deadline(5000);
      } else if (message[1] === subscription) {
        if (message[0] === 'EVENT' && !authPending && message[2]?.pubkey === pubkey && [0, 10390].includes(message[2].kind)) {
          const identity = handleFor(message[2]);
          if (identity) finish(identity);
        } else if (message[0] === 'EOSE' && !authPending) finish();
        else if (message[0] === 'CLOSED' && !authPending && !String(message[2]).startsWith('auth-required:')) finish();
      }
    } catch (_) { finish(); }
  };
});

export const lookupIdentity = async (pubkey, signer) => {
  for (const relay of ['wss://relay.trustroots.org', 'wss://nip42.trustroots.org']) {
    const identity = await lookupRelayIdentity(pubkey, relay, signer);
    if (identity) return identity;
  }
  return '';
};
