## Context

The public chat is a build-free HTML/CSS/JavaScript client. It currently renders a fixed recent timeline, uses initial-only avatars, and filters the room list only by visible room labels. The private auth broker is being extended separately to expose backward-pagination metadata, Matrix/Signal avatar proxy URLs, and Nostr public keys for attributed web messages.

## Goals / Non-Goals

**Goals:**

- Make identity cues consistent across Matrix, bridged Signal, and Nostr-attributed posts.
- Search room metadata, sender labels, and message bodies across history loaded in the browser.
- Load older history incrementally and retain the user's visual position when prepending.
- Make the authenticated chat comfortable and readable on phone-sized viewports.
- Use the available viewport efficiently, remove repetitive message chrome, and communicate room writability before the reader tries to type.
- Keep reaction controls compact and make deletion behavior understandable at the point where a room is selected.
- Preserve safe DOM text rendering and the build-free deployment model.

**Non-Goals:**

- Server-side indexing or searching history that has not been loaded.
- Uploading or editing avatars.
- Replacing the Matrix client or adding threads, attachments, or encrypted-room support.

## Decisions

1. **Render a fallback first, then enhance it with an image.** Every message avatar is a stable initial and identity-derived palette color. If `avatar_url` is present it becomes a nested image; if `nostr_pubkey` is present the client asynchronously resolves a kind-0 profile from the Trustroots relay and applies a valid HTTPS/data image. Image errors remove only the image, leaving the fallback intact. This avoids layout shifts and broken-image icons.

2. **Use one normalized identity key.** Color and Nostr-profile caching use the lower-cased NIP-05 identifier when present, otherwise the Matrix sender ID. Repeated messages from the same identity therefore share the same fallback color regardless of timeline position or pagination page.

3. **Search the locally loaded corpus.** The search control loads each room's first timeline page on first use, then matches normalized room aliases/descriptions, sender labels, and message bodies. Matching rooms remain in the room switcher with result counts; the selected room shows only matching messages. Newly paginated messages immediately join the searchable corpus. This is genuinely full-text over available data without pretending to index unseen Matrix history.

4. **Prepend cursor pages and compensate scroll offset.** The client sends the API's opaque `next_batch` as `before`, deduplicates by event ID, prepends the older page, and restores `scrollTop` by the increase in `scrollHeight`. Automatic refresh continues to replace only the newest page and does not discard previously loaded older pages.

5. **Use dynamic viewport units and explicit mobile touch and text sizes.** Mobile overrides use `100dvh`, a compact sticky navigation region, a condensed room heading, readable type, safe-area composer padding, and at least 44-pixel interactive controls. Search and composer fields use a computed font size of at least 16px so iOS does not zoom the page when they receive focus. Desktop retains the existing two-column layout.

6. **Make room capability a primary state.** `#meta` and `#test` enable the composer; `#hitchat` replaces the composer affordance with a clear read-only explanation. Meta sends and deletes use `room: "meta"` and its 28-day retention, while Test uses 24 hours. The UI does not rely on a small status footnote to communicate this distinction.

7. **Remove always-visible copy actions.** Per-message copy buttons consume a full action column and repeat on every row, especially wastefully on phones. They are removed; native text selection remains available.

8. **Keep reactions inside the message bubble.** Existing reaction counts render as compact buttons and writable rooms expose a small common-emoji picker. Adding a reaction refreshes the timeline so the server remains the source of truth. Read-only Hitchat displays reactions but does not offer web reaction controls.

9. **Put retention policy beside room context.** A short policy line immediately follows each room description. Hitchat and Meta state 28-day deletion; Test states that unreacted messages are deleted after 24 hours and reacted messages after 28 days. The composer expiry label mirrors this rule but is not its only explanation.

## Risks / Trade-offs

- **Nostr relay or image host is unavailable** → retain the initial/color fallback and cache failed profile lookups for the page lifetime.
- **A search result exists only in unloaded history** → label search as applying to loaded messages and allow the reader to load older pages.
- **Rapid refresh races with pagination** → keep per-room message/cursor state and serialize requests for each room.
- **Avatar URLs contain unsafe schemes** → accept only same-origin paths, HTTPS, or constrained data images in the client.
- **Mobile browser chrome changes viewport height** → size the shell with `dvh` and keep the timeline as the sole flexible scroller.
- **iOS zooms focused form fields with small text** → keep mobile search, textarea, and select text at 16px or larger.
- **Reaction controls crowd small messages** → keep them in a wrapping footer inside the bubble and reveal the emoji picker only on demand.
