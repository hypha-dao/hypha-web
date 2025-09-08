# Energy Contracts - Simple Explanation

This document explains what the EnergyToken and EnergySettlement smart contracts do in simple, non-technical terms.

## Overview

These two contracts work together to create a fair energy sharing system where people can:

- Earn rewards for contributing excess energy (like solar power)
- Pay their energy bills when they use more than they contribute
- Help others by paying their energy bills

Think of it like a neighborhood energy cooperative with digital accounting.

---

## EnergyToken Contract

### What it is

The EnergyToken is like **digital reward points or credits** that you earn when you contribute energy to the community grid.

### How it works

- **EnergyTokens are only created when you have a positive balance** - meaning you've contributed more energy than you've used
- When you generate extra renewable energy (like from solar panels), you earn EnergyTokens
- These tokens represent the real monetary value of the energy you've shared
- The tokens are automatically created and managed by the energy system - no one can cheat or create fake tokens
- You can check your token balance at any time to see how much credit you have
- **Important**: If your energy balance is negative (you've used more than you contributed), no EnergyTokens are created - instead, you have a debt that needs to be settled

### Real-world example

Imagine Sarah has solar panels that generated 100 kWh of extra electricity this month. The energy system automatically:

1. Calculates the value of that energy (say €50)
2. Creates 50 EnergyTokens for Sarah
3. Sarah can see she has 50 tokens representing €50 worth of energy credits

### Key features

- **Secure**: Only the authorized energy system can create or destroy tokens
- **Transparent**: Anyone can see token balances
- **Valuable**: Each token represents real monetary value from energy contributions

### What happens with negative balances?

When your energy usage exceeds your contributions, you don't get EnergyTokens. Instead:

- **A debt is recorded** in the energy system (negative balance)
- **No tokens are created** - you can't have "negative tokens"
- **The debt represents money you owe** for the extra energy you consumed
- **You need to settle this debt** using the EnergySettlement contract with real money (EURC)

**Example**: If Tom uses €100 worth of energy but only contributes €30 worth, he has a -€70 balance (debt), not -70 tokens. He needs to pay €70 in real money to clear his debt.

---

## EnergySettlement Contract

### What it is

The EnergySettlement contract is like a **digital payment booth** where people can pay their energy bills using real money (digital Euros called EURC).

### When you need it

- If you've used more energy than you've contributed, you'll have a negative balance (debt)
- Instead of owing the energy system indefinitely, you can pay off this debt with real money
- You might also want to help a friend or family member by paying their energy bill

### How it works

#### Paying your own bill

1. Check how much you owe (your "energy debt")
2. Send digital Euros (EURC) to the contract
3. The system automatically converts your payment and reduces your debt
4. Your energy account balance improves

#### Paying for someone else

1. Choose whose bill you want to pay
2. Send digital Euros to cover their debt
3. Their energy account gets credited, reducing their debt
4. You've helped them while supporting the energy system

### Real-world example

Tom used €75 worth of energy this month but only contributed €25 worth from his small solar setup. He owes €50.

Tom can:

- Pay his €50 debt using digital Euros
- Ask his generous neighbor Alice to help pay part of his bill
- The payment goes to the energy system operators to keep the grid running

### Key features

- **Flexible**: Pay your own bills or help others
- **Automatic**: Payments are instantly converted and applied to energy accounts
- **Transparent**: All payments are recorded and can be tracked
- **Secure**: Only handles legitimate debts and payments

---

## How They Work Together

### The Complete Energy Cycle

1. **Energy Generation**: Sarah generates extra solar energy
2. **Earning Credits**: Sarah receives EnergyTokens representing her contribution
3. **Energy Usage**: Tom uses energy from the shared grid
4. **Debt Creation**: Tom uses more than he contributes, creating a debt
5. **Debt Settlement**: Tom pays his debt using digital Euros through EnergySettlement
6. **System Balance**: The payment goes to system operators, keeping everything running

### Benefits for Users

**For Energy Contributors (like Sarah):**

- Earn valuable tokens for sharing renewable energy
- Create passive income from solar panels or other renewable sources
- Support community energy independence

**For Energy Users (like Tom):**

- Access to clean, shared energy
- Fair pricing based on actual usage
- Flexible payment options including help from others
- Clear, transparent billing

**For the Community:**

- Encourages renewable energy adoption
- Creates a sustainable, self-managing energy network
- Reduces dependence on traditional energy companies
- Promotes energy sharing and cooperation

---

## Security and Trust

### Built-in Protections

- **No fake tokens**: Only the authorized energy system can create EnergyTokens
- **Verified payments**: All debt settlements are verified before processing
- **Transparent records**: Every transaction is recorded on the blockchain
- **Emergency controls**: System administrators can handle unusual situations

### User Safety

- You can only pay existing debts (no overpayments to wrong accounts)
- Payments are processed immediately and transparently
- Your token balance accurately reflects your energy contributions
- The system prevents double-spending and other fraud

---

## Summary

These contracts create a **fair, transparent, and secure energy sharing economy** where:

- People are rewarded for contributing clean energy
- Energy usage is tracked and billed fairly
- Payments are simple and flexible
- The community benefits from shared renewable resources

It's like having a local energy cooperative that runs automatically, rewards good behavior, and makes clean energy accessible to everyone in the community.
