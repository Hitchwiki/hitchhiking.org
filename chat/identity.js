export const allowedNip05Domains = new Set(['trustroots.org', 'hitchwiki.org']);

export const parseNip05Identifier = (value) => {
  const identifier = String(value).trim().toLowerCase();
  const match = /^([a-z0-9._-]+)@([a-z0-9.-]+)$/.exec(identifier);
  if (!match || !allowedNip05Domains.has(match[2])) {
    throw new Error('Use a NIP-05 address at trustroots.org or hitchwiki.org.');
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

const bech32Polymod = (values) => {
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let checksum = 1;
  for (const value of values) {
    const top = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    generators.forEach((generator, index) => { if ((top >>> index) & 1) checksum ^= generator; });
  }
  return checksum;
};

export const hexToNpub = (hex) => {
  const normalized = String(hex).trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new Error('Invalid Nostr public key.');
  const bytes = normalized.match(/.{2}/g).map((pair) => Number.parseInt(pair, 16));
  const words = [];
  let accumulator = 0;
  let bits = 0;
  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) { bits -= 5; words.push((accumulator >>> bits) & 31); }
  }
  if (bits > 0) words.push((accumulator << (5 - bits)) & 31);
  const prefix = 'npub';
  const expandedPrefix = [...prefix].map((char) => char.charCodeAt(0) >>> 5).concat([0], [...prefix].map((char) => char.charCodeAt(0) & 31));
  const polymod = bech32Polymod(expandedPrefix.concat(words, [0, 0, 0, 0, 0, 0])) ^ 1;
  const checksum = Array.from({ length: 6 }, (_, index) => (polymod >>> (5 * (5 - index))) & 31);
  const charset = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  return `${prefix}1${words.concat(checksum).map((word) => charset[word]).join('')}`;
};
