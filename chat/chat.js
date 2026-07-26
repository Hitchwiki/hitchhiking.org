import { parseNip05Identifier, publicKeyForNip05 } from './identity.js';

(() => {
  const form = document.querySelector('#identity-form');
  const input = document.querySelector('#nip05');
  const status = document.querySelector('#status');
  const result = document.querySelector('#result');
  const matrixId = document.querySelector('#matrix-id');
  const nip07 = document.querySelector('#nip07');
  const nip46 = document.querySelector('#nip46');
  const remoteDialog = document.querySelector('#remote-signer-dialog');
  const headerIdentity = document.querySelector('#nostr-identity');
  const nostrDialog = document.querySelector('#nostr-info');
  const nostrRetry = document.querySelector('#nostr-retry');
  let verified = null;

  const setStatus = (message, type = '') => {
    status.textContent = message;
    status.className = `status ${type}`;
  };

  const readIdentifier = () => {
    return parseNip05Identifier(input.value);
  };

  const challenge = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  };

  const validateNip05 = async () => {
    const identity = readIdentifier();
    setStatus(`Looking up ${identity.identifier}…`);
    const response = await fetch(`https://${identity.domain}/.well-known/nostr.json?name=${encodeURIComponent(identity.name)}`, { redirect: 'error' });
    if (!response.ok) throw new Error('This NIP-05 address could not be verified.');
    const data = await response.json();
    const pubkey = publicKeyForNip05(identity, data);
    verified = { ...identity, pubkey };
    setStatus(`Verified ${identity.identifier}. Now use your signer to prove control of the key.`, 'success');
    result.hidden = true;
  };

  const profileNip05 = (pubkey) => new Promise((resolve) => {
    const socket = new WebSocket('wss://relay.trustroots.org');
    const subscription = `hitchhiking-chat-${Math.random().toString(36).slice(2)}`;
    const finish = (value = '') => { try { socket.close(); } catch (_) {} resolve(value); };
    const timer = setTimeout(() => finish(), 3500);
    socket.onopen = () => socket.send(JSON.stringify(['REQ', subscription, { kinds: [0], authors: [pubkey], limit: 1 }]));
    socket.onmessage = ({ data }) => {
      try {
        const message = JSON.parse(data);
        if (message[0] === 'EVENT') {
          const nip05 = JSON.parse(message[2]?.content || '{}').nip05 || '';
          clearTimeout(timer);
          finish(String(nip05).toLowerCase());
        } else if (message[0] === 'EOSE') {
          clearTimeout(timer);
          finish();
        }
      } catch (_) {}
    };
    socket.onerror = () => { clearTimeout(timer); finish(); };
  });

  const setHeaderIdentity = (label, state = 'missing') => {
    headerIdentity.textContent = label;
    headerIdentity.dataset.state = state;
  };

  const autoDetectIdentity = async () => {
    if (!window.nostr?.getPublicKey) { setHeaderIdentity('Nostr: no NIP-07 signer'); return; }
    setHeaderIdentity('Nostr: checking identity…', 'pending');
    try {
      const pubkey = String(await window.nostr.getPublicKey()).toLowerCase();
      const nip05 = await profileNip05(pubkey);
      if (!nip05) { setHeaderIdentity(`Nostr: ${pubkey.slice(0, 8)}…`, 'unlinked'); return; }
      input.value = nip05;
      await validateNip05();
      if (verified.pubkey !== pubkey) throw new Error('The NIP-05 address is linked to a different Nostr key.');
      setHeaderIdentity(`Nostr: ${nip05}`, 'connected');
      setStatus(`Detected and verified ${nip05}. Approve the browser signer below to continue.`, 'success');
    } catch (error) {
      verified = null;
      setHeaderIdentity('Nostr: signer detected — click to connect', 'unlinked');
      setStatus(error.message || 'Could not automatically verify this Nostr identity.', 'error');
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await validateNip05(); } catch (error) { verified = null; setStatus(error.message, 'error'); }
  });

  nip07.addEventListener('click', async () => {
    try {
      if (!verified) await validateNip05();
      if (!window.nostr?.getPublicKey) throw new Error('No NIP-07 browser signer found. Install or unlock a compatible signer, then try again.');
      nip07.disabled = true;
      setStatus('Waiting for your signer…');
      const pubkey = String(await window.nostr.getPublicKey()).toLowerCase();
      if (pubkey !== verified.pubkey) throw new Error(`This signer controls a different key than ${verified.identifier}.`);
      if (!window.nostr.signEvent) throw new Error('This signer can reveal a key but cannot sign a login challenge.');
      setStatus('Please approve the one-time login signature…');
      const signed = await window.nostr.signEvent({
        kind: 27235,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['u', `${location.origin}/chat/`], ['method', 'POST'], ['challenge', challenge()]],
        content: JSON.stringify({ purpose: 'hitchhiking-matrix-sign-in', nip05: verified.identifier })
      });
      if (String(signed?.pubkey || '').toLowerCase() !== pubkey || !signed?.sig) throw new Error('The login challenge was not signed by the expected key.');
      matrixId.textContent = `@${verified.name}:hitchhiking.org`;
      result.hidden = false;
      setStatus('Identity confirmed. Your account can now be created by the Matrix sign-in service.', 'success');
    } catch (error) {
      setStatus(error.message || 'Could not confirm this identity.', 'error');
    } finally { nip07.disabled = false; }
  });

  nip46.addEventListener('click', () => remoteDialog.showModal());
  document.querySelector('[data-close-dialog]').addEventListener('click', () => remoteDialog.close());
  remoteDialog.addEventListener('click', (event) => { if (event.target === remoteDialog) remoteDialog.close(); });
  headerIdentity.addEventListener('click', () => nostrDialog.showModal());
  document.querySelector('[data-close-nostr-dialog]').addEventListener('click', () => nostrDialog.close());
  nostrDialog.addEventListener('click', (event) => { if (event.target === nostrDialog) nostrDialog.close(); });
  nostrRetry.addEventListener('click', autoDetectIdentity);
  setTimeout(autoDetectIdentity, 250);
})();
