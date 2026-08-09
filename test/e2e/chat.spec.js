import { expect, test } from '@playwright/test';

const session = { authenticated: true, nip05: 'alice@trustroots.org', room: { alias: '#hitchat:hitchhiking.org', url: 'https://matrix.to/#/#hitchat:hitchhiking.org' } };

const message = (eventID, sender, body, timestamp, extra = {}) => ({
  event_id: eventID,
  sender,
  body,
  msgtype: 'm.text',
  timestamp,
  ...extra,
});

async function installChatFixtures(page) {
  const state = {
    deleted: [],
    sent: [],
    participants: {
      hitchat: { matrix: 4, signal: 12 },
      meta: { matrix: 3 },
      test: { matrix: 2 },
    },
    timelines: {
      hitchat: [
        message('$alice-one', '@alice:matrix.org', 'First from Alice', 1786262400000, { reactions: [{ key: '👍', count: 3 }] }),
        message('$bob', '@bob:matrix.org', 'Hello from Bob', 1786262460000),
        message('$alice-two', '@alice:matrix.org', 'Second from Alice', 1786262520000),
      ],
      meta: [message('$meta', '@moderator:hitchhiking.org', 'Technical planning', 1786262580000)],
      test: [message('$mine', '@webchat:hitchhiking.org', 'My existing test post', 1786262640000, {
        nip05: 'alice@trustroots.org',
        profile_url: 'https://www.trustroots.org/profile/alice',
      })],
    },
  };

  await page.route('https://1p.hitchhiking.org/**', (route) => route.abort());
  await page.route('**/chat/auth/chat/session', (route) => route.fulfill({ json: session }));
  await page.route('**/chat/auth/chat/participants**', (route) => {
    const room = new URL(route.request().url()).searchParams.get('room') || 'hitchat';
    return route.fulfill({ json: { room, participants: state.participants[room] } });
  });
  await page.route('**/chat/auth/chat/timeline**', (route) => {
    const room = new URL(route.request().url()).searchParams.get('room') || 'hitchat';
    return route.fulfill({ json: { room, messages: state.timelines[room] } });
  });
  await page.route('**/chat/auth/chat/send', async (route) => {
    const payload = route.request().postDataJSON();
    state.sent.push(payload);
    state.timelines.test.push(message('$sent', '@webchat:hitchhiking.org', payload.body, 1786262700000, {
      nip05: session.nip05,
      profile_url: 'https://www.trustroots.org/profile/alice',
    }));
    return route.fulfill({ json: { event_id: '$sent' } });
  });
  await page.route('**/chat/auth/chat/delete', async (route) => {
    const payload = route.request().postDataJSON();
    state.deleted.push(payload);
    state.timelines.test = state.timelines.test.filter((entry) => entry.event_id !== payload.event_id);
    return route.fulfill({ json: { event_id: payload.event_id } });
  });
  return state;
}

test('loads rooms, participant sources, stable avatars, and reactions', async ({ page }) => {
  const state = await installChatFixtures(page);
  await page.goto('/chat/#hitchat');

  await expect(page.locator('#room-title')).toHaveText('#hitchat:hitchhiking.org');
  await expect(page.locator('#timeline .timeline-message')).toHaveCount(3);
  await expect(page.locator('#room-participants')).toContainText('Matrix 4');
  await expect(page.locator('#room-participants')).toContainText('Signal 12');
  await expect(page.locator('#room-participants')).toContainText('NIP-05 0');
  await expect(page.getByLabel('Message reactions').getByText('👍 3')).toBeVisible();

  const aliceAvatars = page.locator('.timeline-message').filter({ hasText: '@alice:matrix.org' }).locator('.timeline-avatar');
  await expect(aliceAvatars).toHaveCount(2);
  const colors = await aliceAvatars.evaluateAll((avatars) => avatars.map((avatar) => getComputedStyle(avatar).backgroundColor));
  expect(new Set(colors).size).toBe(1);

  state.timelines.hitchat[0].reactions[0].count = 4;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByLabel('Message reactions').getByText('👍 4')).toBeVisible();

  await page.getByRole('link', { name: '#meta' }).click();
  await expect(page).toHaveURL(/\/chat\/#meta$/);
  await expect(page.locator('#room-title')).toHaveText('#meta:hitchhiking.org');
  await expect(page.locator('#timeline')).toContainText('Technical planning');
  await expect(page.locator('#room-participants')).toContainText('Matrix 3');
  await expect(page.locator('#room-participants')).not.toContainText('Signal');
});

test('sends and deletes own Test messages through same-origin APIs', async ({ page }) => {
  const state = await installChatFixtures(page);
  await page.goto('/chat/#test');

  const input = page.getByLabel('Message input');
  await expect(input).toBeEditable();
  await input.fill('New browser test post');
  await input.press('Enter');
  await expect.poll(() => state.sent).toEqual([{ room: 'test', body: 'New browser test post' }]);
  await expect(page.locator('#timeline')).toContainText('New browser test post');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete your message' }).first().click();
  await expect.poll(() => state.deleted.length).toBe(1);
  await expect(page.locator('#timeline')).not.toContainText('My existing test post');
});
