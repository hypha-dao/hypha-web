# Energy Credits & Settlement

A plain-language explanation of how the community tracks energy bills on the blockchain and how members pay.

---

## What Is an Energy Credit?

When you own a share of the community's solar park or battery, you earn money every time those assets produce energy. An **Energy Credit** is a digital token that represents money the community owes you. It lives on the blockchain and shows up in your wallet, just like a digital euro would.

Think of it like a loyalty balance: the community keeps a running tab of what you've earned and what you've spent on electricity. If you've earned more than you've spent, you hold Energy Credits. If you've spent more than you've earned, you have a debt to pay off.

---

## How Your Balance Gets Calculated

Every 15 minutes, the system does three things:

1. **Reads the meters** — how much electricity did each household use? How much did the solar park and battery produce?
2. **Splits the energy fairly** — each member gets a share of the locally produced energy based on how much of the solar park or battery they own. Cheaper sources (solar) are used first, then battery, then the expensive grid.
3. **Updates the balance** — for each member, it compares what they owe (for the energy they used) against what they earned (their ownership share of the revenue). The difference is recorded on the blockchain.

### A simple example

```
Alice owns 30% of the solar park. This interval:
  She used €0.16 worth of electricity.
  Her 30% ownership earned her €0.18 in revenue.
  Result: Alice is up €0.02 → she receives an Energy Credit.

Bob owns 30% of the solar park. This interval:
  He used €0.64 worth of electricity (he has a big household).
  His 30% ownership earned him €0.25 in revenue.
  Result: Bob is down €0.39 → he has a debt to pay.

Eve owns 10% of the solar park. She's an investor — no house, no electricity use.
  She used €0.00.
  Her 10% ownership earned her €0.13 in revenue.
  Result: Eve is up €0.13 → she receives an Energy Credit (pure investment return).
```

These small amounts add up over days and weeks into a meaningful balance.

---

## Credits vs. Debts

| Your situation | What it means | What you see |
|---|---|---|
| **You earned more than you used** | The community owes you money | Energy Credits appear in your wallet |
| **You used more than you earned** | You owe the community money | A debt balance shows in the app |
| **Perfectly even** | Nothing owed either way | Zero balance |

The system always balances: every cent someone is charged appears as a credit for someone else (asset owners, the community fund, or the grid operator). If the numbers ever don't add up, the blockchain rejects the transaction entirely — a built-in safety check.

---

## Paying Your Bill (Settlement)

Members who owe the community pay their debt using **EURC** — a digital euro on the blockchain. 1 EURC = €1, always.

Here's what it looks like in practice:

1. **Open the community app** and see your balance (e.g., "You owe €39.44").
2. **Tap "Pay"** — the app sends your EURC to the community's payment address.
3. **Your debt decreases** by the amount you paid. If you paid it all, your balance goes to zero.

A few things to know:

- **Pay any amount** — you don't have to pay the full debt at once. Partial payments are fine.
- **Someone else can pay for you** — a family member or the community itself can cover your debt.
- **No overpaying** — if you accidentally try to pay more than you owe, the system only takes what's needed.

---

## Summary

```
  Solar park & battery produce energy
              │
              ▼
  System measures what each member used
  and what each member earned (every 15 min)
              │
              ▼
       ┌──────┴──────┐
       │             │
   You earned     You used
   more than      more than
   you used       you earned
       │             │
       ▼             ▼
   Energy Credit    Debt
  (in your wallet)  (pay with digital euros)
```

- **Energy Credits** = money the community owes you, visible as tokens in your wallet.
- **Debts** = money you owe the community, paid off with digital euros (EURC) whenever you're ready.
- **Everything is recorded on the blockchain** — transparent, tamper-proof, and always balanced.
