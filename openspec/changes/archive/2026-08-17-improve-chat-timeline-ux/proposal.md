## Why

The authenticated chat is difficult to scan on phones, exposes only initials even when a sender has a profile image, and searches only three room names. Readers also cannot move beyond the first bounded history page, which is especially limiting in `#hitchat`.

## What Changes

- Show sender avatars supplied by Matrix, bridged Signal profiles, or Nostr attribution, with stable identity-derived initials and colors when no usable image exists.
- Keep the chat search control and make it match room names, sender identities, and loaded message text.
- Add progressive scrollback that prepends older messages without losing the reader's scroll position.
- Rework the narrow-screen layout so room navigation, search, message actions, timeline, and composer remain usable on mobile devices and with mobile browser chrome.
- Remove repetitive per-message copy buttons, compact message and room-header spacing, make read-only rooms unmistakable, and allow web posting in `#meta` as well as `#test`.
- Show and add compact emoji reactions in writable rooms, and state each room's deletion policy beside its description, including Test's 24-hour default and 28-day reacted-message retention.
- Add automated browser coverage for avatar fallbacks, message search, pagination, and mobile layout behavior.

## Capabilities

### New Capabilities

- `chat-timeline-experience`: Accessible avatar presentation, loaded-history search, progressive scrollback, reactions, explicit retention guidance, and responsive chat layout.

### Modified Capabilities

None.

## Impact

- Public files: `chat/index.html`, `chat/chat.js`, `chat/chat.css`, and the `/about` explanation of writable rooms.
- Public browser and source tests under `test/`.
- Consumes optional `avatar_url`, `next_batch`, and `has_more` fields from the separately operated `/chat/auth/chat/timeline` API while retaining safe text-only rendering.
- Adds OpenSpec configuration and change artifacts to the public repository; no runtime dependency or build step is added.
