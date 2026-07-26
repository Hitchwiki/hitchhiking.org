## Context

The static `/chat` client currently validates a NIP-05 address in the browser and can ask a NIP-07 signer to sign a prototype event. Browser-only checks cannot safely issue Matrix credentials, prevent replay, protect homeserver administration, or establish a durable mapping between a Nostr key and a Matrix account.

The target is a federated Matrix homeserver. Local Hitchhiking accounts are passwordless and restricted to Nostr keys that are currently attested by `hitchwiki.org` or `trustroots.org`. Federation remains the route for users who already have accounts elsewhere.

## Goals / Non-Goals

**Goals:**

- Provide a dedicated authentication service that acts as the trusted bridge between Nostr and Matrix SSO/OIDC.
- Accept only fresh, backend-issued, single-use login challenges signed by the Nostr key being authenticated.
- Verify NIP-05 server-side, with exact-domain allowlisting and no browser/CORS dependency.
- Create a deterministic, human-readable Matrix localpart from the NIP-05 name while preserving the public key as the immutable identity link.
- Keep the homeserver administrative API and all secrets private to the service.

**Non-Goals:**

- Replacing Matrix federation, Matrix end-to-end encryption, or external homeserver authentication.
- Supporting arbitrary NIP-05 domains, password login, email-based local signup, guest identity, or NIP-46 in the first release.
- Providing automatic recovery after a user loses their Nostr key.
- Bridging Matrix room traffic to Nostr or Trustroots relays.

## Decisions

### Use an OIDC-facing Nostr authentication service

The service SHALL be configured as the homeserver's OIDC identity provider. It owns the browser login flow, then returns standard OIDC claims to Matrix after verification. This keeps Matrix session/device handling inside Matrix and prevents the static site from handling homeserver administrator credentials.

Alternative considered: call Synapse administrative APIs directly from `/chat`. Rejected because it exposes privileged capabilities to an untrusted browser and does not provide a durable SSO session flow.

### Require a backend-issued signed challenge

The service SHALL create a cryptographically random nonce, bind it to the OIDC authorization request and intended callback, store only a short-lived server-side record, and accept it exactly once. The Nostr signer SHALL sign a fresh Nostr event containing the nonce, request URL, method, and timestamp. The service verifies the event signature, expected public key, request binding, event kind, freshness, and nonce consumption before issuing an authorization result.

Alternative considered: trust `window.nostr.getPublicKey()` or a browser-generated nonce. Rejected because neither provides server-verifiable proof resistant to replay or browser tampering.

### Treat the Nostr public key as canonical; derive the Matrix name from NIP-05

The persistent link is the lowercase 64-character Nostr public key. At registration and every login, the service resolves the supplied NIP-05 address at the exact allowed domain and requires its `names[name]` value to equal that public key. The Matrix localpart is the NIP-05 local name; if unavailable, the service tries `name2`, `name3`, and so on. Existing public-key mappings always win over naming collisions.

Alternative considered: make the Matrix ID an `npub`. Rejected because readable NIP-05-derived Matrix IDs are the intended community-facing identity.

### Use a minimal account-link store

The service stores public data required for authorization: Nostr public key, Matrix user ID, NIP-05 address/domain at enrollment, creation/update timestamps, and account state. It SHALL NOT store Nostr private keys, Matrix passwords, reusable signed challenges, or raw OIDC tokens beyond their required short lifetime.

### Fail closed and keep recovery manual

Network failures, redirects, malformed documents, expired challenges, and NIP-05/public-key mismatches deny local SSO. A lost key does not permit automatic reassignment of the old Matrix ID. Any exception requires a documented moderator process with audit logging.

## Risks / Trade-offs

- [NIP-05 availability or domain changes lock out a valid key] → Cache only as an optimization; check live server-side at login and provide a manual support path.
- [Nostr signature/replay implementation error] → Use a reviewed Nostr library, strict nonce expiry/single-use storage, clock tolerance, and integration tests for replay and mismatch cases.
- [Username squatting or collisions] → Require NIP-05 plus signature before provisioning; reserve existing mappings; append numeric suffixes deterministically.
- [Homeserver admin API compromise] → Keep credentials in a secret manager, scope network access, and never expose them to the client.
- [Operational overhead] → Add rate limits, structured audit logs, health checks, backups for the account-link store, and monitoring before public rollout.

## Migration Plan

1. Deploy the service and its database without enabling it for the homeserver.
2. Configure a staging Matrix homeserver/client with the OIDC provider and test challenge verification, provisioning, collision handling, and federation.
3. Publish the Nostr login path in `/chat` behind a feature flag and allow a small moderator-controlled cohort.
4. Enable it for the production homeserver after abuse controls, backups, and an incident/recovery runbook are reviewed.
5. Roll back by disabling the OIDC provider and account provisioning; existing Matrix accounts and federation remain intact.

## Open Questions

- Which homeserver and SSO component will be operated in production (Synapse directly with OIDC, or a Matrix Authentication Service deployment)?
- Which production datastore and secret manager will host the account-link records and homeserver credentials?
- What moderator evidence and approval process is acceptable for a lost-key or disputed-name recovery?
- Should valid existing Trustroots/Hitchwiki accounts receive any rate-limit bypass, or should all local signups use the same limits?
