## Context

Current discovery queries only relay.trustroots.org and converts a timeout or empty result into an absent-identity claim.

## Goals / Non-Goals

Goals: discover profiles at nip42.trustroots.org and let eligible members recover from discovery failure. Non-goals: changing accepted domains or server authorization.

## Decisions

Try the public relay first, then wss://nip42.trustroots.org. On AUTH, sign kind 22242 with the exact relay and challenge tags, wait for matching successful OK, and reissue the subscription. Bound network waits, allow 60 seconds for signer approval, close sockets, and ignore unrelated subscriptions or authors. Identity hints remain untrusted until the existing server NIP-05 verification succeeds.

Provide a labeled identity form. On submission read the active signer key and use the existing signed HTTP challenge flow. Serialize automatic and manual sign-in so a delayed discovery result cannot overwrite a manual attempt. Never claim verification before server acceptance.

## Risks / Trade-offs

An additional signer prompt is necessary for the authenticated relay. Rejection and timeouts retain direct entry. Server mismatch rejection remains authoritative.
