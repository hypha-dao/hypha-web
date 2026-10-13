### Security Best Practices

#### Authentication & Authorization

- All mutations require auth token validation via Privy JWT
- Server actions receive `{ authToken }` and pass to RLS-aware DB connections
- Neon RLS policies enforce row-level access — `people` table restricts writes to own rows via `auth.user_id()`
- Never expose server-only secrets in client bundles — enforce via `./client` and `./server` exports

#### Input Validation

- Validate all inputs with Zod schemas before database operations
- Sanitize user-generated content (descriptions, titles) before rendering
- Use parameterized queries (Drizzle ORM) — never interpolate user input into SQL

#### Web3 Security

- Smart contracts use UUPS upgradeable proxy pattern with `OwnableUpgradeable`
- Proposal execution goes through per-space `Executor` contracts
- Validate on-chain state before trusting off-chain copies (`web3SpaceId`, `web3ProposalId`)

#### Infrastructure

- CSP headers enforced via middleware (Privy frames, WalletConnect, OneSignal whitelisted)
- `X-Frame-Options: DENY` on all non-API routes
- Environment variables for secrets — `PRIVATE_KEY`, `DEFAULT_DB_AUTHENTICATED_URL` never committed
