(() => {
  const allowedDomains = new Set(['hitchwiki.org', 'trustroots.org']);
  const form = document.querySelector('#identity-form');
  const input = document.querySelector('#nip05');
  const status = document.querySelector('#status');
  const result = document.querySelector('#result');
  const matrixId = document.querySelector('#matrix-id');
  const nip07 = document.querySelector('#nip07');
  const nip46 = document.querySelector('#nip46');
  const remoteDialog = document.querySelector('#remote-signer-dialog');
  let verified = null;

  const setStatus = (message, type = '') => {
    status.textContent = message;
    status.className = `status ${type}`;
  };

  const readIdentifier = () => {
    const identifier = input.value.trim().toLowerCase();
    const match = /^([a-z0-9._-]+)@([a-z0-9.-]+)$/.exec(identifier);
    if (!match || !allowedDomains.has(match[2])) throw new Error('Use a NIP-05 address at hitchwiki.org or trustroots.org.');
    return { identifier, name: match[1], domain: match[2] };
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
    const pubkey = String(data?.names?.[identity.name] || '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(pubkey)) throw new Error('This address does not currently have a valid Nostr public key.');
    verified = { ...identity, pubkey };
    setStatus(`Verified ${identity.identifier}. Now use your signer to prove control of the key.`, 'success');
    result.hidden = true;
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
})();
