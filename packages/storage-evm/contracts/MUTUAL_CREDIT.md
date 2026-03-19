# Mutual Credit

Mutual credit is an optional feature built into `RegularSpaceToken`. It lets eligible members spend tokens they don't have yet, up to a shared credit limit. Think of it like an overdraft — you can go negative, and it gets paid back automatically when you receive tokens.

## How it works

### Sending (going into debt)

When Alice transfers 100 tokens but only has 30:

1. The contract sees she's short by 70.
2. It checks she's a member of a credit-whitelisted space.
3. It checks 70 doesn't exceed her remaining credit limit.
4. 70 tokens are minted to her address (her `creditBalance` becomes 70).
5. The full 100 are transferred to the recipient.

### Receiving (auto-repayment)

When Alice (who owes 70) receives 50 tokens:

1. The contract sees she has a credit debt of 70.
2. 50 tokens are automatically burned to repay her debt.
3. Her `creditBalance` drops from 70 to 20.
4. She ends up with 0 in her wallet but only owes 20 now.

### Who is eligible

A member gets credit if they belong to any space on the **credit whitelist**. Every eligible member shares the same `defaultCreditLimit`.

## Enabling credit

### Disabled by default

If `defaultCreditLimit` is 0 and no spaces are credit-whitelisted, the feature is completely inactive. Transfers work like a normal ERC-20.

### At token creation

Pass `defaultCreditLimit` and `initialCreditWhitelistSpaceIds` when deploying through the factory.

### After token creation

The executor can call:

```solidity
enableCredit(1000 * 10**18, [42, 99])
```

This sets the credit limit to 1000 tokens and whitelists spaces 42 and 99 in a single transaction.

## Admin functions (executor only)

| Function | What it does |
|---|---|
| `enableCredit(limit, spaceIds)` | Set credit limit + add whitelisted spaces in one call |
| `setDefaultCreditLimit(limit)` | Change just the credit limit |
| `batchAddCreditWhitelistSpaces(ids)` | Add spaces to the credit whitelist |
| `batchRemoveCreditWhitelistSpaces(ids)` | Remove spaces from the credit whitelist |

## Read functions

| Function | Returns |
|---|---|
| `defaultCreditLimit()` | The current credit limit |
| `creditLimitOf(account)` | `defaultCreditLimit` if the account is eligible, otherwise 0 |
| `creditLimitLeftOf(account)` | How much credit the account can still use |
| `creditBalanceOf(account)` | How much the account currently owes |
| `netBalanceOf(account)` | `balance - debt` (can be negative) |
| `getCreditWhitelistedSpaces()` | Array of whitelisted space IDs |

## Important details

- Credit mints are subject to the same `maxSupply` cap as executor mints. If the token is near its cap, credit usage may be limited.
- `totalSupply` reflects the total outstanding credit across all members.
- Repayment is automatic — whenever a debtor receives tokens, their debt shrinks.
- Setting `defaultCreditLimit` to 0 effectively freezes new credit usage (existing debts still repay on receive).
