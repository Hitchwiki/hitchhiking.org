## 1. Service foundation

- [ ] 1.1 Select the production Matrix SSO integration (Synapse OIDC or Matrix Authentication Service), deployment environment, datastore, and secret manager.
- [ ] 1.2 Create the Nostr SSO service with configuration validation, health endpoint, structured logs, rate limits, and production secret handling.
- [ ] 1.3 Define and migrate the account-link schema for Nostr public keys, Matrix user IDs, NIP-05 metadata, account state, and audit records.

## 2. Nostr authentication

- [ ] 2.1 Implement backend-issued, short-lived, single-use authorization challenges bound to the OIDC request and callback.
- [ ] 2.2 Verify signed Nostr login events with a reviewed Nostr library, including signature, event kind, timestamp, request binding, and nonce checks.
- [ ] 2.3 Resolve NIP-05 server-side without redirects and enforce exact allowlisting for `hitchwiki.org` and `trustroots.org`.
- [ ] 2.4 Add tests for valid authentication, expired/replayed challenge, malformed event, signature mismatch, NIP-05 mismatch, untrusted domain, and resolver failure.

## 3. Matrix identity and SSO

- [ ] 3.1 Implement idempotent public-key-to-Matrix-account lookup and account provisioning through the protected homeserver integration.
- [ ] 3.2 Implement NIP-05 localpart allocation with deterministic numeric suffixes and concurrent-collision protection.
- [ ] 3.3 Implement the OIDC authorization response and claims needed for Matrix session creation.
- [ ] 3.4 Configure and test the staging homeserver/client against the SSO service, including a user from an external federated homeserver joining a public room without Nostr SSO.

## 4. Client, operations, and rollout

- [ ] 4.1 Replace `/chat`'s browser-generated prototype challenge with the backend challenge and OIDC redirect flow.
- [ ] 4.2 Add clear client-facing states for ineligible identity, key mismatch, expired challenge, rate limiting, and existing external Matrix accounts.
- [ ] 4.3 Write moderator recovery, disputed-name, incident, backup, monitoring, and rollback runbooks.
- [ ] 4.4 Run a moderator-controlled pilot, review abuse and reliability metrics, then enable production signup behind a feature flag.
