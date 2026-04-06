import { usePrivy, useCrossAppAccounts, useWallets } from '@privy-io/react-auth';

export default function App() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { loginWithCrossAppAccount } = useCrossAppAccounts();
  const { wallets } = useWallets();

  const PROVIDER_APP_ID = 'cm5y07p2z02napk1cutzzx7o6';

  const crossAppAccount = user?.linkedAccounts?.find(
    (a) => a.type === 'cross_app',
  );

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Global Wallet Test</h1>
        <p style={styles.subtitle}>
          Provider app: <code style={styles.code}>{PROVIDER_APP_ID}</code>
        </p>

        {!ready && <p style={styles.muted}>Loading Privy…</p>}

        {ready && !authenticated && (
          <div style={styles.actions}>
            <button style={styles.btn} onClick={login}>
              Login (Privy modal)
            </button>
            <button
              style={{ ...styles.btn, ...styles.btnAccent }}
              onClick={() =>
                loginWithCrossAppAccount({ appId: PROVIDER_APP_ID })
              }
            >
              Login with Global Wallet
            </button>
          </div>
        )}

        {ready && authenticated && (
          <div style={styles.info}>
            <Section title="User">
              <Pre>{JSON.stringify(user, null, 2)}</Pre>
            </Section>

            {crossAppAccount && (
              <Section title="Cross-App Account">
                <Pre>{JSON.stringify(crossAppAccount, null, 2)}</Pre>
              </Section>
            )}

            <Section title={`Wallets (${wallets.length})`}>
              {wallets.length === 0 && <p style={styles.muted}>No wallets</p>}
              {wallets.map((w) => (
                <div key={w.address} style={styles.wallet}>
                  <span style={styles.mono}>{w.address}</span>
                  <span style={styles.badge}>{w.walletClientType}</span>
                </div>
              ))}
            </Section>

            <button
              style={{ ...styles.btn, ...styles.btnDanger }}
              onClick={logout}
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      {children}
    </div>
  );
}

function Pre({ children }: { children: React.ReactNode }) {
  return <pre style={styles.pre}>{children}</pre>;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#e5e5e5',
    padding: 24,
  },
  card: {
    background: '#171717',
    borderRadius: 16,
    padding: 32,
    maxWidth: 600,
    width: '100%',
    border: '1px solid #262626',
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    color: '#fafafa',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#a3a3a3',
  },
  code: {
    background: '#262626',
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  muted: { color: '#737373', fontSize: 14 },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 24,
  },
  btn: {
    padding: '12px 20px',
    borderRadius: 10,
    border: 'none',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    background: '#262626',
    color: '#fafafa',
    transition: 'background 0.15s',
  },
  btnAccent: {
    background: '#7C3AED',
    color: '#fff',
  },
  btnDanger: {
    background: '#7f1d1d',
    color: '#fca5a5',
    marginTop: 16,
  },
  info: { marginTop: 24 },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    color: '#a3a3a3',
    marginBottom: 8,
  },
  pre: {
    background: '#0a0a0a',
    border: '1px solid #262626',
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
    fontFamily: 'monospace',
    overflow: 'auto',
    maxHeight: 300,
    color: '#d4d4d4',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  wallet: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: '#0a0a0a',
    borderRadius: 8,
    marginBottom: 6,
    border: '1px solid #262626',
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#d4d4d4',
  },
  badge: {
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 6,
    background: '#262626',
    color: '#a3a3a3',
    fontWeight: 600,
  },
};
