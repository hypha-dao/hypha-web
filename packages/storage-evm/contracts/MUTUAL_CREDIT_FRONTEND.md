# Mutual Credit (Frontend Quick Guide)

This doc is a simple integration guide for frontend development with `RegularSpaceToken` mutual credit.

## What mutual credit does

- If an eligible user sends more tokens than they hold, the shortfall is created as credit (debt).
- When that user later receives tokens, debt is repaid automatically first.
- Eligibility is based on membership in credit-whitelisted spaces.

## Main read calls for UI

- `defaultCreditLimit()` -> global credit limit for eligible members.
- `creditLimitOf(account)` -> credit limit for this account (0 if not eligible).
- `creditLimitLeftOf(account)` -> remaining credit room.
- `creditBalanceOf(account)` -> current debt.
- `netBalanceOf(account)` -> balance minus debt (can be negative).
- `getCreditWhitelistedSpaces()` -> space IDs that grant credit eligibility.

## Suggested wallet panel

Show these values together:

- Token balance
- Credit debt
- Credit remaining
- Net balance

This helps users understand why a transfer can still succeed even if balance is low.

## Common UX behaviors

- If transfer fails with `Insufficient credit`, show: "Amount is above your available balance + credit limit."
- If token is near max supply, credit usage can fail because credit minting is supply-capped.
- Debt repayment is automatic on receive; no explicit repay transaction is needed.

## Admin actions (executor only)

- `enableCredit(limit, spaceIds)`
- `setDefaultCreditLimit(limit)`
- `batchAddCreditWhitelistSpaces(ids)`
- `batchRemoveCreditWhitelistSpaces(ids)`

For frontend admin pages, gate these actions to executor-only views.
