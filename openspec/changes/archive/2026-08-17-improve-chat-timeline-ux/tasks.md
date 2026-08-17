## 1. Timeline state and avatars

- [x] 1.1 Store per-room messages, pagination cursors, request state, and deduplicated event IDs
- [x] 1.2 Render safe Matrix/Signal avatar URLs over deterministic initial-and-color fallbacks
- [x] 1.3 Resolve and cache safe Nostr kind-0 profile pictures without breaking fallbacks

## 2. Search and scrollback

- [x] 2.1 Keep the search control and match room metadata, senders, and message bodies across loaded room timelines
- [x] 2.2 Show room result counts and filter the selected timeline without unsafe HTML rendering
- [x] 2.3 Add older-message pagination that prepends deduplicated events and preserves scroll position

## 3. Responsive interface

- [x] 3.1 Refine the chat header, room switcher, timeline, actions, and composer for narrow dynamic viewports, with 16px mobile form text to prevent iPhone focus zoom
- [x] 3.2 Compact room metadata and message alignment, remove per-message copy buttons, and avoid wasted action-column space
- [x] 3.3 Make Hitchat's read-only state prominent and enable Meta composing/deletion with 28-day expiry
- [x] 3.4 Provide accessible search, pagination status, and touch-sized controls without horizontal page overflow

## 4. Reactions and retention guidance

- [x] 4.1 Render existing reaction counts and add compact reaction controls for Meta and Test
- [x] 4.2 Show the deletion policy directly beside every room description, including Test's conditional 24-hour/28-day rule

## 5. Verification

- [x] 5.1 Extend source tests for the additive avatar, search, pagination, reactions, retention guidance, and mobile contracts
- [x] 5.2 Extend Playwright fixtures and tests for images/fallbacks, cross-room full-text search, scrollback, reactions, and phone layout
- [x] 5.3 Run the complete public test and release checks
