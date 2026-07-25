(() => {
  const status = document.getElementById('nostr-identity');
  if (!status) return;
  const setStatus = (label, state = 'missing') => { status.textContent = label; status.dataset.state = state; };
  const trustrootsHandle = (event) => {
    try {
      const nip05 = JSON.parse(event.content || '{}').nip05 || '';
      if (/^[a-z0-9_.-]+@trustroots\.org$/i.test(nip05)) return nip05.toLowerCase();
    } catch (_) {}
    const tag = (event.tags || []).find((item) => item[0] === 'trustroots' || (item[0] === 'l' && item[2] === 'org.trustroots:username'));
    return tag?.[1] && /^[a-z0-9_.-]+$/i.test(tag[1]) ? `${tag[1].toLowerCase()}@trustroots.org` : '';
  };
  const lookup = (pubkey) => new Promise((resolve) => {
    const socket = new WebSocket('wss://relay.trustroots.org');
    const id = `hitchhiking-${Math.random().toString(36).slice(2)}`;
    const finish = (value = '') => { try { socket.close(); } catch (_) {} resolve(value); };
    const timer = setTimeout(finish, 3500);
    socket.onopen = () => socket.send(JSON.stringify(['REQ', id, { kinds: [0, 10390], authors: [pubkey], limit: 10 }]));
    socket.onmessage = ({ data }) => { try { const message = JSON.parse(data); if (message[0] === 'EVENT') { const handle = trustrootsHandle(message[2]); if (handle) { clearTimeout(timer); finish(handle); } } if (message[0] === 'EOSE') { clearTimeout(timer); finish(); } } catch (_) {} };
    socket.onerror = () => { clearTimeout(timer); finish(); };
  });
  const connect = async () => {
    if (!window.nostr?.getPublicKey) return setStatus('Nostr: no NIP-07 signer');
    setStatus('Nostr: checking identity…', 'pending');
    try {
      const pubkey = String(await window.nostr.getPublicKey()).toLowerCase();
      const handle = await lookup(pubkey);
      setStatus(handle ? handle : `Nostr: ${pubkey.slice(0, 8)}…`, handle ? 'connected' : 'unlinked');
    } catch (_) { setStatus('Nostr: signer not connected'); }
  };
  connect();
})();
