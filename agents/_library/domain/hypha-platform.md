### Hypha Platform Domain

Hypha is a DAO toolkit platform enabling decentralized organizations to govern, manage treasuries, and coordinate members on-chain.

#### Core Entities

| Entity         | Description                                                                                   | Key Fields                                                          |
| -------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Space**      | A DAO organization with hierarchy (parent/child), categories, and on-chain identity           | `slug`, `web3SpaceId`, `parentId`, `categories`, `flags`, `address` |
| **Document**   | Governance artifact progressing through states: `discussion` -> `proposal` -> `agreement`     | `state`, `creatorId`, `spaceId`, `web3ProposalId`, `label`          |
| **Person**     | User profile linked to a Privy auth identity and optional Web3 wallet                         | `sub` (Privy), `address` (wallet), `slug`, `email`                  |
| **Membership** | Join between Person and Space (unique constraint on pair)                                     | `personId`, `spaceId`                                               |
| **Token**      | Space-scoped token with types: utility, credits, ownership, voice, impact, community_currency | `symbol`, `type`, `transferable`, `isVotingToken`, `decayInterval`  |
| **Event**      | Polymorphic activity log across all entities                                                  | `type`, `referenceEntity`, `referenceId`, `parameters`              |
| **Transfer**   | On-chain fund transfer with memo                                                              | `transactionHash`, `memo`                                           |

#### Governance Flow

1. A member creates a **discussion** document in a space
2. Discussion is promoted to a **proposal** with on-chain voting via `DAOProposalsImplementation`
3. Approved proposal becomes an **agreement** executed through a per-space `Executor` contract
4. Agreement plugins handle specific actions: deploy funds, issue tokens, change entry/exit methods, manage membership

#### Dual Storage

- **PostgreSQL (Neon):** Relational data, full-text search, user profiles, memberships
- **EVM (Base chain):** Governance state, voting, token contracts, space factory — bridged via `web3SpaceId` and `web3ProposalId`

#### Agreement Plugins

Propose contribution, deploy funds, pay expenses, change entry/exit methods, buy Hypha tokens, activate spaces, issue tokens, mint tokens to treasury, space-to-space membership, space transparency settings.
