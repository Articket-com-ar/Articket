# ADR-0006: Payments current semantics (confirmed paths only)

- Status: Accepted
- Date: 2026-03-11
- Owners: Backend / Payments

## Context
The current payment flow has two confirmed entry points that can mark an order as paid:

- `POST /checkout/confirm`
- `POST /webhooks/payments/:provider`

Both paths are validated in code and integration tests. The current behavior is defined by `materializePayment(...)`, webhook persistence/dedupe, and the paid transition side effects exercised by:

- `checkoutConfirmIdempotency.integration.test.ts`
- `paymentConvergence.integration.test.ts`
- `webhookConcurrency.test.ts`

This ADR records only the behavior that is currently implemented and validated.

## Decision
- `Payment` is the canonical persisted record of a payment fact for the currently supported confirm/webhook paid flows.
- The strong payment identity is `(provider, providerRef)`.
- Webhook envelope dedupe uses `(provider, providerEventId)` and is distinct from payment identity.
- `confirm` and `webhook` converge through `materializePayment(...)`.
- For the currently validated confirm/webhook paid flows, when `confirm` and `webhook` resolve to the same `(provider, providerRef)`, they converge to a single `Payment` row.
- A repeated webhook envelope with the same `(provider, providerEventId)` returns `200` with `deduped: true`.
- A paid webhook without provider payment identity returns `422` with code `MISSING_PAYMENT_IDENTITY`.
- A webhook that tries to use an existing `(provider, providerRef)` for a different order returns `409` with code `PAYMENT_REFERENCE_ALREADY_USED`.
- The paid flow currently includes these effects inside the transactional path:
  - persist or reuse `Payment`
  - move `Order.status` to `paid` when allowed
  - emit `ORDER_PAID`
  - issue tickets if absent
  - emit `TICKETS_ISSUED`
  - release active inventory reservations

## Consequences
- Duplicate webhook delivery of the same provider event is treated as envelope replay, not as a new payment.
- The same payment fact arriving first by webhook and later by confirm, or first by confirm and later by webhook, converges to one `Payment` row when `(provider, providerRef)` matches.
- A provider event may be persisted before downstream processing completes; failed processing does not imply successful business application of the payment.
- `Payment` is currently the durable source used to detect payment identity conflicts across orders for these paths.
- Current limits:
  - This ADR does not claim semantics for providers not yet integrated beyond the generic webhook path.
  - This ADR does not claim refund, chargeback, partial capture, or multi-step authorization semantics.
  - Webhook dedupe is about event envelope identity, not provider business intent beyond the validated fields.
  - Notification/worker behavior is not part of this payment identity contract.

## No objectives
- Define a future universal payment model.
- Document provider-specific mappings not yet implemented.
- Claim support for payment states not validated by current tests.
- Claim exactly-once semantics beyond the paths and effects currently covered by code and tests.
