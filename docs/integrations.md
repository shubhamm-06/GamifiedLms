# Integrations

No third-party integration is built yet. This file stays close to empty
until one exists — do not pre-fill speculative detail.

## Planned: external payment gateway

Referenced throughout the schema (`payments` table, `courses.external_product_id`,
`enrollments.source = 'purchase'`) but **no webhook receiver exists** — nothing
can currently insert a `payments` row, since that requires `service_role`
(see `schema.md` RLS matrix). Provider not yet chosen. When this is built:
purpose, endpoints called, webhook payload shape, rate limits, and idempotency
handling belong here — the idempotency *mechanism* (`provider_payment_id`
unique constraint) is already documented in `schema.md` since it's a DB fact,
not an API-integration fact; don't duplicate it here, cross-reference it.
