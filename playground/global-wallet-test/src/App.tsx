import {
  usePrivy,
  useCrossAppAccounts,
  useWallets,
} from '@privy-io/react-auth';

interface AppProps {
  providerAppId: string;
}

export default function App({ providerAppId }: AppProps) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { loginWithCrossAppAccount } = useCrossAppAccounts();
  const { wallets } = useWallets();

  const crossAppAccount = user?.linkedAccounts?.find(
    (a) => a.type === 'cross_app' && a.providerApp?.id === providerAppId,
  );

  if (!ready) {
    return (
      <div className="container">
        <p>Loading Privy…</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Privy Global Wallet — Consumer Test</h1>
      <p className="muted">
        Consumer app: <code>{import.meta.env.VITE_PRIVY_APP_ID}</code>
        <br />
        Provider app: <code>{providerAppId}</code>
      </p>

      {!authenticated ? (
        <div className="actions">
          <button onClick={login}>Login (Privy modal)</button>
          <button
            className="primary"
            onClick={() => loginWithCrossAppAccount({ appId: providerAppId })}
          >
            Login with Global Wallet
          </button>
        </div>
      ) : (
        <div className="actions">
          <button onClick={logout}>Logout</button>
        </div>
      )}

      {authenticated && (
        <section>
          <h2>User</h2>
          <pre>{JSON.stringify(user, null, 2)}</pre>

          <h2>Cross-app account</h2>
          <pre>
            {crossAppAccount
              ? JSON.stringify(crossAppAccount, null, 2)
              : 'No cross-app account linked yet.'}
          </pre>

          <h2>Wallets ({wallets.length})</h2>
          <pre>
            {JSON.stringify(
              wallets.map((w) => ({
                address: w.address,
                chainId: w.chainId,
                walletClientType: w.walletClientType,
                connectorType: w.connectorType,
              })),
              null,
              2,
            )}
          </pre>
        </section>
      )}
    </div>
  );
}
