## ADDED Requirements

### Requirement: Eligible Nostr identities can start Matrix SSO
The system SHALL start local Matrix SSO only for a Nostr public key that proves control of a backend-issued, single-use challenge and has a currently valid NIP-05 identity at exactly `hitchwiki.org` or `trustroots.org`.

#### Scenario: Trusted NIP-05 identity starts SSO
- **WHEN** a signer submits a fresh valid challenge signature and `alice@trustroots.org` resolves to the signing public key
- **THEN** the system SHALL continue the OIDC authorization flow for that identity

#### Scenario: Untrusted NIP-05 domain is rejected
- **WHEN** a signer submits a valid signature with an identifier at any domain other than `hitchwiki.org` or `trustroots.org`
- **THEN** the system SHALL deny local Matrix SSO and SHALL NOT provision an account

### Requirement: Login challenges resist replay and substitution
The system SHALL issue cryptographically random challenges bound to one authorization request, accept each challenge no more than once, and reject challenges that are expired, malformed, signed by a different public key, or bound to a different request.

#### Scenario: Replayed challenge is rejected
- **WHEN** a previously accepted signed challenge is submitted again
- **THEN** the system SHALL deny the request and record a replay-safe audit event

#### Scenario: Public-key substitution is rejected
- **WHEN** the signed event public key differs from the public key resolved by the supplied NIP-05 identifier
- **THEN** the system SHALL deny the request and SHALL NOT create a Matrix session

### Requirement: Matrix accounts are provisioned from verified NIP-05 names
The system SHALL map each verified Nostr public key to one local Matrix user ID. For a newly verified key, it SHALL first attempt the NIP-05 local name as the Matrix localpart and SHALL append the lowest available positive integer when that localpart belongs to a different key.

#### Scenario: Available NIP-05 name becomes Matrix ID
- **WHEN** `tom@hitchwiki.org` is verified and `@tom:hitchhiking.org` is available
- **THEN** the system SHALL provision and link `@tom:hitchhiking.org`

#### Scenario: Name collision receives a numeric suffix
- **WHEN** `@tom:hitchhiking.org` is already linked to a different Nostr public key
- **THEN** the system SHALL provision the first available localpart in the sequence `tom2`, `tom3`, and onward

#### Scenario: Existing key keeps its linked Matrix account
- **WHEN** a public key that already has a Matrix account completes a valid login
- **THEN** the system SHALL authenticate that existing Matrix account without allocating another localpart

### Requirement: Matrix federation remains independent
The system SHALL NOT require Nostr SSO for users of external Matrix homeservers to join public Hitchhiking rooms.

#### Scenario: External Matrix user joins a public room
- **WHEN** a user with an account on `matrix.org` or another federated homeserver joins a public Hitchhiking room
- **THEN** the homeserver SHALL handle the room membership through normal Matrix federation without invoking the Nostr SSO service

### Requirement: Sensitive identity material is protected
The system SHALL store only the public Nostr key, Matrix account link, allowed NIP-05 identity metadata, and operational audit data needed to run the service. It SHALL NOT store Nostr private keys, Matrix passwords, or reusable login challenges.

#### Scenario: Service persistence is inspected
- **WHEN** the account-link store is reviewed
- **THEN** it SHALL contain no Nostr private key, Matrix password, or consumed reusable challenge value
