### Incident Response Framework

#### Debugging Process

1. **Reproduce:** Establish reliable reproduction steps — which environment, user state, input data?
2. **Isolate:** Determine which layer is failing: UI rendering, server action, database query, or on-chain state
3. **Trace:** Follow the data flow: component -> hook -> server action -> mutation/query -> database/contract
4. **Root Cause:** Identify the specific line/condition causing the failure
5. **Fix:** Implement the minimal change that addresses root cause without side effects
6. **Verify:** Confirm fix resolves the issue AND doesn't break related flows
7. **Prevent:** Add a test that would catch this regression

#### Layer-Specific Debugging

| Layer               | Technique                                                                 |
| ------------------- | ------------------------------------------------------------------------- |
| **UI**              | React DevTools, browser console, component props inspection               |
| **Server Actions**  | Server-side logging, `revalidatePath` verification, auth token inspection |
| **Database**        | Direct Neon console queries, Drizzle query logging, migration state check |
| **Smart Contracts** | Hardhat console, event log inspection, contract state reads via `viem`    |
| **Auth**            | Privy dashboard, JWT decode, RLS policy verification                      |
