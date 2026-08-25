import { expect, test } from '@playwright/test';

const session = { authenticated: true, nip05: 'alice@trustroots.org', room: { alias: '#hitchat:hitchhiking.org', url: 'https://matrix.to/#/#hitchat:hitchhiking.org' } };

const message = (eventID, sender, body, timestamp, extra = {}) => ({ event_id: eventID, sender, body, msgtype: 'm.text', timestamp, ...extra });

async function installChatFixtures(page) {
  const state = {
    deleted: [],
    sent: [],
    reacted: [],
    olderRequests: [],
    participants: {
      hitchat: { matrix: 4, signal: 12 },
      meta: { matrix: 3 },
      test: { matrix: 2 },
    },
    timelines: {
      hitchat: [
        message('$alice-one', '@alice:matrix.org', 'First from Alice', 1786262400000, { reactions: [{ key: '👍', count: 3 }], avatar_url: '/test-avatar.png' }),
        message('$bob', '@bob:matrix.org', 'Hello from Bob', 1786262460000),
        message('$alice-two', '@alice:matrix.org', 'Second from Alice', 1786262520000, { avatar_url: '/test-avatar.png' }),
      ],
      meta: [message('$meta', '@moderator:hitchhiking.org', 'Technical planning', 1786262580000)],
      test: [message('$mine', '@webchat:hitchhiking.org', 'My existing test post', 1786262640000, {
        nip05: 'alice@trustroots.org',
        profile_url: 'https://www.trustroots.org/profile/alice',
      })],
    },
    older: [message('$older', '@traveller:matrix.org', 'An older Hitchat memory', 1786176000000)],
  };

  await page.route('https://1p.hitchhiking.org/**', (route) => route.abort());
  await page.route('**/test-avatar.png', (route) => route.fulfill({
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  }));
  await page.route('**/chat/auth/chat/session', (route) => route.fulfill({ json: session }));
  await page.route('**/chat/auth/chat/participants**', (route) => {
    const room = new URL(route.request().url()).searchParams.get('room') || 'hitchat';
    return route.fulfill({ json: { room, participants: state.participants[room] } });
  });
  await page.route('**/chat/auth/chat/timeline**', (route) => {
    const params = new URL(route.request().url()).searchParams;
    const room = params.get('room') || 'hitchat';
    const before = params.get('before');
    if (before) {
      state.olderRequests.push({ room, before });
      return route.fulfill({ json: { room, messages: state.older, next_batch: '', has_more: false } });
    }
    return route.fulfill({ json: { room, messages: state.timelines[room], next_batch: room === 'hitchat' ? 'older-cursor' : '', has_more: room === 'hitchat' } });
  });
  await page.route('**/chat/auth/chat/send', async (route) => {
    const payload = route.request().postDataJSON();
    state.sent.push(payload);
    state.timelines[payload.room].push(message(`$sent-${payload.room}`, '@webchat:hitchhiking.org', payload.body, 1786262700000, {
      nip05: session.nip05,
      profile_url: 'https://www.trustroots.org/profile/alice',
    }));
    return route.fulfill({ json: { event_id: `$sent-${payload.room}` } });
  });
  await page.route('**/chat/auth/chat/delete', async (route) => {
    const payload = route.request().postDataJSON();
    state.deleted.push(payload);
    state.timelines[payload.room] = state.timelines[payload.room].filter((entry) => entry.event_id !== payload.event_id);
    return route.fulfill({ json: { event_id: payload.event_id } });
  });
  await page.route('**/chat/auth/chat/react', async (route) => {
    const payload = route.request().postDataJSON();
    state.reacted.push(payload);
    const target = state.timelines[payload.room].find((entry) => entry.event_id === payload.event_id);
    if (target) {
      target.reactions ||= [];
      const existing = target.reactions.find((reaction) => reaction.key === payload.key);
      if (existing?.mine) {
        existing.count -= 1;
        target.reactions = target.reactions.filter((reaction) => reaction.count > 0);
        return route.fulfill({ json: { event_id: '$reaction', active: false } });
      }
      if (existing) {
        existing.count += 1;
        existing.mine = true;
      } else target.reactions.push({ key: payload.key, count: 1, mine: true });
    }
    return route.fulfill({ json: { event_id: '$reaction', active: true } });
  });
  return state;
}

async function installNip07Fixtures(page, { injectionDelay = 0, signerFailures = 0, challengeFailures = 0 } = {}) {
  const pubkey = 'a'.repeat(64);
  const state = { authorized: false, challenges: 0, verifies: [] };

  await page.addInitScript(({ injectedPubkey, delay, failures }) => {
    window.__nip07Calls = { getPublicKey: 0, signed: [] };
    class RelaySocket {
      constructor() { setTimeout(() => this.onopen?.(), 0); }
      send(raw) {
        const [, subscription] = JSON.parse(raw);
        setTimeout(() => {
          this.onmessage?.({ data: JSON.stringify(['EVENT', subscription, {
            kind: 0,
            pubkey: injectedPubkey,
            tags: [],
            content: JSON.stringify({ nip05: 'alice@trustroots.org' }),
          }]) });
          this.onmessage?.({ data: JSON.stringify(['EOSE', subscription]) });
        }, 0);
      }
      close() {}
    }
    window.WebSocket = RelaySocket;
    setTimeout(() => {
      window.nostr = {
        getPublicKey: async () => {
          window.__nip07Calls.getPublicKey += 1;
          if (window.__nip07Calls.getPublicKey <= failures) throw new Error('Signer is locked');
          return injectedPubkey;
        },
        signEvent: async (event) => {
          window.__nip07Calls.signed.push(event);
          return { ...event, pubkey: injectedPubkey, id: 'b'.repeat(64), sig: 'c'.repeat(128) };
        },
      };
    }, delay);
  }, { injectedPubkey: pubkey, delay: injectionDelay, failures: signerFailures });

  await page.route('https://1p.hitchhiking.org/**', (route) => route.abort());
  await page.route('**/chat/auth/chat/session', (route) => route.fulfill({
    status: state.authorized ? 200 : 401,
    json: state.authorized ? session : { error: 'Sign in required.' },
  }));
  await page.route('**/chat/auth/login/trustroots/challenge', (route) => {
    state.challenges += 1;
    if (state.challenges <= challengeFailures) {
      return route.fulfill({ status: 503, json: { error: 'Authorization is temporarily unavailable.' } });
    }
    return route.fulfill({ json: { challenge_id: 'challenge-id', challenge: 'challenge-value' } });
  });
  await page.route('**/chat/auth/chat/verify', (route) => {
    state.verifies.push(route.request().postDataJSON());
    state.authorized = true;
    return route.fulfill({ json: { authenticated: true } });
  });
  await page.route('**/chat/auth/chat/timeline**', (route) => route.fulfill({
    json: { room: 'hitchat', messages: [], next_batch: '', has_more: false },
  }));
  await page.route('**/chat/auth/chat/participants**', (route) => route.fulfill({
    json: { room: 'hitchat', participants: { matrix: 0, signal: 0 } },
  }));
  return { pubkey, state };
}

test('authorizes a NIP-07 signer that is injected after page load', async ({ page }) => {
  const { pubkey, state } = await installNip07Fixtures(page, { injectionDelay: 600 });
  await page.goto('/chat/');

  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#nostr-identity')).toHaveText('Nostr: alice@trustroots.org');
  await expect.poll(() => state.verifies).toHaveLength(1);
  expect(state.verifies[0]).toMatchObject({ challenge_id: 'challenge-id', nip05: 'alice@trustroots.org' });
  expect(state.verifies[0].event).toMatchObject({ kind: 27235, pubkey, content: '' });
  expect(state.verifies[0].event.tags).toEqual([
    ['u', 'http://127.0.0.1:4173/chat/auth/chat/verify'],
    ['method', 'POST'],
    ['challenge', 'challenge-value'],
  ]);
});

test('can retry after a locked NIP-07 signer is unlocked', async ({ page }) => {
  await installNip07Fixtures(page, { signerFailures: 1 });
  await page.goto('/chat/');

  await expect(page.locator('.sign-in-card')).toBeVisible();
  await page.locator('#nostr-identity').click();
  await page.getByRole('button', { name: 'Check my signer again' }).click();
  await expect(page.locator('#result')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__nip07Calls.getPublicKey)).toBe(2);
});

test('can retry after a transient NIP-07 authorization failure', async ({ page }) => {
  const { state } = await installNip07Fixtures(page, { challengeFailures: 1 });
  await page.goto('/chat/');

  await expect(page.getByText('Authorization is temporarily unavailable.')).toBeVisible();
  await page.getByRole('button', { name: 'Try NIP-07 again' }).click();
  await expect(page.locator('#result')).toBeVisible();
  expect(state.challenges).toBe(2);
  expect(state.verifies).toHaveLength(1);
});

test('shows avatars, stable fallbacks, reactions, and the room policy', async ({ page }) => {
  await installChatFixtures(page);
  await page.goto('/chat/#hitchat');

  await expect(page.locator('#room-title')).toHaveText('#hitchat:hitchhiking.org');
  await expect(page.locator('#room-policy')).toContainText('deleted after 28 days');
  await expect(page.locator('#timeline .timeline-message')).toHaveCount(3);
  await expect(page.locator('#room-participants')).toContainText('Matrix 4');
  await expect(page.locator('#room-participants')).toContainText('Signal 12');
  await expect(page.locator('.sidebar-footer')).toContainText('2026-08-17 17:40');
  await expect(page.getByRole('link', { name: 'hitchhiking.org source on GitHub' })).toBeVisible();
  await expect(page.getByLabel('Message reactions').getByText('👍 3')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add a reaction' })).toHaveCount(0);
  await expect(page.locator('.timeline-avatar-image')).toHaveCount(2);

  const aliceAvatars = page.locator('.timeline-message').filter({ hasText: '@alice:matrix.org' }).locator('.timeline-avatar');
  const colors = await aliceAvatars.evaluateAll((avatars) => avatars.map((avatar) => getComputedStyle(avatar).backgroundColor));
  expect(new Set(colors).size).toBe(1);
  await expect(page.locator('.message-copy')).toHaveCount(0);
});

test('searches message text across rooms and loads older Hitchat history', async ({ page }) => {
  const state = await installChatFixtures(page);
  await page.goto('/chat/#hitchat');

  await page.getByPlaceholder('Search chats and messages').fill('Technical planning');
  await expect(page.getByRole('link', { name: /#meta/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /#hitchat/ })).toBeHidden();
  await page.getByRole('link', { name: /#meta/ }).click();
  await expect(page.locator('#timeline')).toContainText('Technical planning');

  await page.getByPlaceholder('Search chats and messages').fill('');
  await page.getByRole('link', { name: /#hitchat/ }).click();
  await page.getByRole('button', { name: 'Load older messages' }).click();
  await expect.poll(() => state.olderRequests).toEqual([{ room: 'hitchat', before: 'older-cursor' }]);
  await expect(page.locator('#timeline')).toContainText('An older Hitchat memory');
});

test('Meta is writable, supports reactions and deletion, while Test explains conditional retention', async ({ page }) => {
  const state = await installChatFixtures(page);
  await page.goto('/chat/#meta');

  await expect(page.getByLabel('Message input')).toBeEditable();
  await expect(page.locator('#room-policy')).toContainText('28 days');
  await page.getByRole('button', { name: 'Add a reaction' }).click();
  await page.getByRole('button', { name: 'React with 👍' }).click();
  await expect.poll(() => state.reacted).toEqual([{ room: 'meta', event_id: '$meta', key: '👍' }]);
  await expect(page.getByLabel('Message reactions').getByText('👍 1')).toBeVisible();
  await page.getByRole('button', { name: 'Remove your 👍 reaction' }).click();
  await expect.poll(() => state.reacted).toEqual([
    { room: 'meta', event_id: '$meta', key: '👍' },
    { room: 'meta', event_id: '$meta', key: '👍' },
  ]);
  await expect(page.getByLabel('Message reactions').getByText('👍 1')).toHaveCount(0);

  const input = page.getByLabel('Message input');
  await input.fill('New Meta post');
  await input.press('Enter');
  await expect.poll(() => state.sent).toEqual([{ room: 'meta', body: 'New Meta post' }]);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete your message' }).click();
  await expect.poll(() => state.deleted).toEqual([{ room: 'meta', event_id: '$sent-meta' }]);

  await page.getByRole('link', { name: /#test/ }).click();
  await expect(page.locator('#room-policy')).toContainText('without reactions are deleted after 24 hours');
  await expect(page.locator('#room-policy')).toContainText('up to 28 days');
});

test('mobile layout stays compact and avoids iPhone focus zoom', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await installChatFixtures(page);
  await page.goto('/chat/#hitchat');

  await expect(page.locator('#room-readonly')).toBeVisible();
  await expect(page.locator('.sidebar-footer')).toBeHidden();
  await expect(page.locator('#chat-composer')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.getByRole('link', { name: /#meta/ }).click();
  await page.getByRole('button', { name: 'Add a reaction' }).click();
  await expect(page.locator('.reaction-picker')).toBeVisible();
  const sizes = await page.evaluate(() => ({
    search: parseFloat(getComputedStyle(document.querySelector('#chat-filter')).fontSize),
    input: parseFloat(getComputedStyle(document.querySelector('#message-input')).fontSize),
    expiry: parseFloat(getComputedStyle(document.querySelector('#message-expiry')).fontSize),
  }));
  expect(sizes.search).toBeGreaterThanOrEqual(16);
  expect(sizes.input).toBeGreaterThanOrEqual(16);
  expect(sizes.expiry).toBeGreaterThanOrEqual(16);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#room-title').click();
  await expect(page.locator('.reaction-picker')).toBeHidden();
});
