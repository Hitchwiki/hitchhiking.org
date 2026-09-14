import { hexToNpub } from './nostr-key.js';
import { lookupIdentity } from './nostr-relay-identity.js';

(() => {
  const status = document.getElementById('nostr-identity');
  if (!status) return;
  const modal = document.getElementById('nostr-info');
  const retry = document.getElementById('nostr-retry');
  const setStatus = (label, state = 'missing') => { status.textContent = label; status.dataset.state = state; };
  let connecting = false;
  const connect = async () => {
    if (connecting) return false;
    if (!window.nostr?.getPublicKey) return false;
    connecting = true;
    setStatus('Nostr: checking identity…', 'pending');
    try {
      const pubkey = String(await window.nostr.getPublicKey()).toLowerCase();
      const handle = await lookupIdentity(pubkey, window.nostr);
      setStatus(handle ? handle : `Nostr: ${hexToNpub(pubkey)}`, handle ? 'connected' : 'unlinked');
      window.hitchhikingNostrIdentity = { pubkey, nip05: handle };
      window.dispatchEvent(new CustomEvent('hitchhiking:nostr-identity', { detail: window.hitchhikingNostrIdentity }));
    } catch (_) {
      setStatus('Nostr: signer detected — click to connect', 'unlinked');
      window.dispatchEvent(new CustomEvent('hitchhiking:nostr-unavailable'));
    } finally {
      connecting = false;
    }
    return true;
  };
  const startedAt = Date.now();
  const timer = setInterval(async () => {
    if (await connect()) return clearInterval(timer);
    if (Date.now() - startedAt > 12000) {
      clearInterval(timer);
      setStatus('Nostr: no NIP-07 signer');
      window.dispatchEvent(new CustomEvent('hitchhiking:nostr-unavailable'));
    } else {
      setStatus('Nostr: waiting for NIP-07…', 'pending');
    }
  }, 250);
  status.addEventListener('click', () => {
    if (modal?.showModal) modal.showModal();
    else modal?.setAttribute('open', '');
  });
  retry?.addEventListener('click', async () => {
    if (!await connect()) setStatus('Nostr: no NIP-07 signer');
  });
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) modal.close();
  });
})();
