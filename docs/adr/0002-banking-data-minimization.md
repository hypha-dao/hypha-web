# ADR 0002 — Banking data minimization (Bridge as processor)

## Status

Accepted (GH-2268 Bridge-first banking refactor).

## Context

Space banking (KYB, virtual accounts, one-time transfers) integrates with Bridge. Deposit instructions contain financial identifiers (IBAN, account numbers, routing). KYB flows expose verification links and business contact data.

Hypha must minimize personal data stored in PostgreSQL while still letting authorized space delegates operate banking in the product.

## Decision

1. **Persist only** a `bank_customers` row per `(space_id, provider)` with:
   - `provider_customer_id` (Bridge customer id, when known)
   - `provider_kyc_link_id` (Bridge KYC link resource id, not a URL)
   - `requested_rails` (Hypha configuration: which deposit currencies the space opted into — not PII)
   - `entity_type`, timestamps
2. **Do not persist** in Hypha DB: legal name, email, KYC/TOS URLs, deposit instructions, Bridge receipts, virtual account rows, or transfer rows. Resolve contact email from Bridge (`GET /v0/kyc_links/{id}` or customer) when calling endorsement KYC endpoints — never from the authenticated requester.
3. **Bridge is the source of truth** for accounts, transfers, endorsement/rail status, and deposit instructions. Hypha fetches on read and maps to typed API DTOs.
4. **Display is processing, not storage**: showing deposit details to an authenticated delegate still requires lawful basis, access control, and avoidance of logging or caching sensitive payloads (no long-lived client storage of instructions).
5. **Processor role**: Bridge holds verification and banking payloads under Hypha’s DPA/sub-processor arrangements.

## Consequences

- Banking tab and gear dialog trigger Bridge API calls (customer, KYC link, list accounts, list transfers).
- No `pending_kyb` local rows; create operations call Bridge only when customer and rail are ready.
- Activate endpoints and `bank_virtual_accounts` / `bank_transfers` tables are removed.
- Engineers must not log Bridge response bodies in production paths.

## In-product notice

Banking advanced UI may show: deposit details are loaded from the banking partner and are not saved on Hypha servers.
