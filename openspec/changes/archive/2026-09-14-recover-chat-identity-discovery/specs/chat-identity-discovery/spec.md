## ADDED Requirements

### Requirement: Authenticated relay discovery
The client SHALL query nip42.trustroots.org when public relay discovery does not find an eligible identity. It SHALL authenticate using NIP-42 and retry its subscription only after a matching successful acknowledgement. Relay events SHALL be scoped to the requested subscription and signer public key.

#### Scenario: Identity exists on authenticated relay
- **WHEN** the public relay yields no identity and the authenticated relay requests AUTH
- **THEN** the signer signs kind 22242 with relay and challenge tags and an accepted authentication permits identity discovery and chat authorization

#### Scenario: Authentication fails
- **WHEN** relay authentication is rejected, times out, or the signer declines
- **THEN** discovery ends without claiming the identity does not exist and direct entry remains available

### Requirement: Direct identity recovery
The chat SHALL allow entering an eligible NIP-05 identity and authorizing with the active NIP-07 signer regardless of relay discovery success. It SHALL reveal the room only after successful server verification and session retrieval.

#### Scenario: Metadata unavailable
- **WHEN** a user supplies an eligible identity after empty relay discovery
- **THEN** the client requests a fresh signed HTTP challenge and opens the room after server acceptance

#### Scenario: Key mismatch
- **WHEN** the server rejects an entered identity because it does not match the signer
- **THEN** the form remains usable, the error is shown, and the room remains hidden
