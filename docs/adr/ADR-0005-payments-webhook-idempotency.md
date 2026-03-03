# ADR-0005: Payment webhook idempotency and exactly-once effects

## Status
Accepted

## Context
Payment providers deliver webhooks with at-least-once semantics. Duplicate deliveries, retries, and concurrent deliveries are expected. We must prevent duplicate paid transitions and duplicate ticket issuance while keeping retries safe when processing fails.

## Decision
1. **Idempotency identity**
   - Primary dedupe key is `(provider, providerEventId)`.
   - `providerEventId` must come from provider official event ID when available.
   - Current extractor is `externalEventId || eventId || id`; provider-specific mapping must be tightened per provider integration before production rollout.

2. **Provider event state machine**
   - Event states: `received | processing | processed | error` (+ operational dedupe/in-flight outcomes).
   - Duplicate delivery behavior:
     - `processed` => deduped no-op (2xx)
     - `processing` with active lease => in-flight (202)
     - `received/error` or expired lease => retry claim and process

3. **Exactly-once side effects**
   - Effects (`Order.status -> paid`, `Payment upsert`, ticket issuance, reservation release) are protected by DB transaction + row lock + guarded status update.
   - This guarantees exactly-once effects even with concurrent deliveries.

4. **Delivery semantics**
   - Provider delivery remains at-least-once.
   - Consumer effects are exactly-once per `(provider, providerEventId)` once processing reaches `processed`.

## Consequences
- Duplicate deliveries no longer create duplicate business side effects.
- Failed attempts remain retryable (not permanently deduped).
- Requires operational cleanup policy for historical idempotency/event rows.
