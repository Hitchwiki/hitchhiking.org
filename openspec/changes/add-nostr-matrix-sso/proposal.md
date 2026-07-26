## Why

The `/chat` prototype can detect and validate a Nostr identity in the browser, but it cannot safely create Matrix accounts or issue Matrix sessions. A server-side authentication flow is needed to verify one-time signatures, enforce the Hitchwiki/Trustroots identity policy, and connect approved users to the Hitchhiking Matrix homeserver without passwords.

## What Changes

- Add a Nostr-backed SSO service for the Hitchhiking Matrix homeserver.
- Verify a short-lived, single-use Nostr login challenge and validate the associated NIP-05 identity server-side.
- Allow local account creation only for NIP-05 identities at `hitchwiki.org` or `trustroots.org`.
- Provision and link local Matrix accounts using the NIP-05 local name, appending a number when that Matrix localpart is already taken.
- Integrate the service with Matrix SSO/OIDC so it creates Matrix sessions without collecting a local password or email address.
- Keep federation unchanged: existing accounts from `matrix.org` and other homeservers can join public Hitchhiking rooms without using this service.

## Capabilities

### New Capabilities

- `nostr-matrix-sso`: Authenticate eligible Nostr identities, provision linked Matrix accounts, and issue Matrix SSO sessions.

### Modified Capabilities

- None.

## Impact

- New backend service, persistent identity/account-link storage, and protected administrative access to the Matrix homeserver.
- Matrix homeserver SSO/OIDC configuration and operational secrets.
- The `/chat` client will exchange its locally generated prototype challenge for backend-issued challenges and sessions.
- Deployment, monitoring, abuse controls, backups, and account-recovery policy need to be defined before production rollout.
