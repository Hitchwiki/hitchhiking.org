export const allowedNip05Domains = new Set(['hitchwiki.org', 'trustroots.org']);

export const parseNip05Identifier = (value) => {
  const identifier = String(value).trim().toLowerCase();
  const match = /^([a-z0-9._-]+)@([a-z0-9.-]+)$/.exec(identifier);
  if (!match || !allowedNip05Domains.has(match[2])) {
    throw new Error('Use a NIP-05 address at hitchwiki.org or trustroots.org.');
  }
  return { identifier, name: match[1], domain: match[2] };
};

export const publicKeyForNip05 = (identity, document) => {
  const pubkey = String(document?.names?.[identity.name] || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(pubkey)) {
    throw new Error('This address does not currently have a valid Nostr public key.');
  }
  return pubkey;
};
