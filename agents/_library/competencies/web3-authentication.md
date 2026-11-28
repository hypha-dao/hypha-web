### Web3 Authentication

#### Stack

- **Provider:** Privy (`@privy-io/react-auth`) with Coinbase Smart Wallets (`SmartWalletsProvider`)
- **Chain:** Base (mainnet) as default chain
- **EVM:** Wagmi via `@privy-io/wagmi` wrapper, `viem` for contract reads/writes
- **Package:** `@hypha-platform/authentication` exports `AuthProvider` and `useAuthentication` hook

#### Auth Flow

1. User calls `login()` via Privy modal (email, social, or wallet)
2. Privy creates/links a smart wallet on Base chain
3. `useAuthentication()` returns `{ isAuthenticated, user, getAccessToken, ... }`
4. Server actions receive JWT via `getAccessToken()` as `{ authToken }`
5. RLS-aware DB connections pass auth token to Neon: `getDb({ authToken })`

#### Key Types

```typescript
interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  wallet?: { address?: `0x${string}` };
}

interface AuthHook {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  login: () => void;
  logout: (redirect?: boolean) => void;
  getAccessToken: () => Promise<string | null>;
}
```

#### Provider Nesting Order

`AuthProvider > ThemeProvider > EvmProvider > NotificationSubscriber`
