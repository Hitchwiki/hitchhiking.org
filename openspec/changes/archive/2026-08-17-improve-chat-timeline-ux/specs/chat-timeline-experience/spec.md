## ADDED Requirements

### Requirement: Multi-source sender avatars
The chat SHALL show a sender profile image supplied through Matrix, a bridged Signal member profile, or Nostr metadata when a usable image is available. It MUST preserve a deterministic initial and identity-derived color as the fallback when no image exists or image loading fails.

#### Scenario: Matrix or Signal avatar is available
- **WHEN** a timeline message contains a safe `avatar_url`
- **THEN** the message shows that image inside the sender's stable avatar fallback

#### Scenario: Nostr avatar is available
- **WHEN** a Nostr-attributed message contains a public key whose current kind-0 metadata has a safe picture URL
- **THEN** all loaded messages attributed to that public key show the Nostr profile image

#### Scenario: Avatar is absent or broken
- **WHEN** no safe avatar URL is available or an avatar image fails to load
- **THEN** messages from the same normalized sender identity show the same initial and fallback color

### Requirement: Loaded-history full-text search
The chat search SHALL match room aliases and descriptions, sender labels, and message body text across the timeline pages currently loaded for every configured room. Search matching MUST be case-insensitive and MUST NOT render message text as HTML.

#### Scenario: Message text matches another room
- **WHEN** a reader enters text found in a loaded message in a non-selected room
- **THEN** that room remains visible with its match count and can be selected to see the matching messages

#### Scenario: Search query is cleared
- **WHEN** the reader clears the search control
- **THEN** all configured rooms and all loaded messages in the selected room are visible again

### Requirement: Progressive backward timeline navigation
The chat SHALL let an authenticated reader request older pages for a room while a continuation cursor is available. It MUST deduplicate events and preserve the reader's visible scroll position when older events are prepended.

#### Scenario: Older Hitchat history is available
- **WHEN** a reader activates “Load older messages” in `#hitchat`
- **THEN** the client requests the current room with its opaque cursor and prepends the returned older messages without jumping to the newest message

#### Scenario: History is exhausted
- **WHEN** the API reports no further cursor
- **THEN** the older-message control is disabled or removed and no further pagination request is sent

### Requirement: Mobile-first chat layout
The authenticated chat SHALL remain readable and operable at phone viewport widths and heights, including dynamic browser chrome and safe-area insets. Primary interactive controls SHALL provide touch-sized targets, mobile search and composer fields MUST use at least a 16-pixel computed font size to avoid iOS focus zoom, and the timeline SHALL remain the main scrolling region.

#### Scenario: Reader uses a narrow phone
- **WHEN** the chat is viewed at a 375-pixel-wide mobile viewport
- **THEN** the header, search, room navigation, messages, actions, and composer fit without horizontal page overflow or overlapping controls

#### Scenario: Mobile browser chrome changes height
- **WHEN** the browser's visible viewport height changes
- **THEN** the composer remains reachable and the timeline resizes within the visible dynamic viewport

#### Scenario: iPhone reader focuses the composer
- **WHEN** a reader focuses the search field, message textarea, or expiry selector on iPhone
- **THEN** the browser keeps the page at its current zoom level and the surrounding chat controls remain usable

### Requirement: Space-efficient message presentation
The chat SHALL align avatars and message bubbles consistently, use available width without excessive empty action columns, and keep room metadata compact enough that messages remain the primary content. It MUST NOT show a dedicated copy button on every message.

#### Scenario: Reader scans messages on a phone
- **WHEN** messages of different lengths are shown at a narrow viewport
- **THEN** avatars, bubbles, sender labels, timestamps, and optional delete actions form a consistent compact column without a per-message copy control

### Requirement: Clear room writability
The chat SHALL allow verified web posting and own-message deletion in `#meta` and `#test`, using 28-day and 24-hour expiry respectively. It MUST present `#hitchat` as clearly read-only before the reader attempts to type.

#### Scenario: Reader opens Meta
- **WHEN** an authenticated reader selects `#meta`
- **THEN** the composer is editable, displays 28-day expiry, and sends messages to Meta

#### Scenario: Reader opens Hitchat
- **WHEN** an authenticated reader selects `#hitchat`
- **THEN** a prominent read-only explanation replaces or clearly disables the composer input and send action

### Requirement: Compact message reactions
The chat SHALL display aggregated message reactions and SHALL let authenticated readers add a supported emoji reaction in `#meta` and `#test`. Reaction controls MUST fit within the message bubble without restoring a dedicated action column. `#hitchat` SHALL display reactions but remain non-interactive from the web client.

#### Scenario: Reader reacts in a writable room
- **WHEN** a reader chooses a supported emoji on a Meta or Test message
- **THEN** the client submits the room, target event, and emoji and refreshes the aggregate count

#### Scenario: Reader views reactions in Hitchat
- **WHEN** a Hitchat message has reactions
- **THEN** their emoji and counts are visible without an add-reaction control

### Requirement: Visible deletion policy
The chat SHALL place a concise deletion policy next to each selected room's description. It MUST state that Hitchat and Meta messages are deleted after 28 days and that Test messages without reactions are deleted after 24 hours while messages with at least one reaction are retained for up to 28 days.

#### Scenario: Reader selects Test
- **WHEN** Test becomes the selected room
- **THEN** its description immediately explains both the 24-hour default and the 28-day reacted-message retention
