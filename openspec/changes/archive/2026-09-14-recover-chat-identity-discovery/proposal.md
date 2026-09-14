## Why

Chat mistakes missing relay metadata for a missing eligible identity. Members whose profile is available through the authenticated Trustroots relay cannot sign in.

## What Changes

- Discover identities through the public relay and NIP-42 authenticated relay.
- Allow direct NIP-05 entry when discovery fails, preserving server verification.
- Test authenticated discovery and recovery in browsers.

## Capabilities

### New Capabilities
- `chat-identity-discovery`: Authenticated relay discovery and direct identity recovery.

### Modified Capabilities
None.

## Impact

Shared identity JavaScript, chat sign-in UI, browser tests. No backend credential or permission changes.
