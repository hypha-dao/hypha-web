import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import App from './App';
import './styles.css';

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;
const PROVIDER_APP_ID = 'cm5y07p2z02napk1cutzzx7o6';

if (!PRIVY_APP_ID) {
  throw new Error('VITE_PRIVY_APP_ID is not set in .env');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethodsAndOrder: {
          primary: [`privy:${PROVIDER_APP_ID}`, 'email'],
          overflow: ['detected_ethereum_wallets'],
        },
        appearance: {
          theme: 'light',
          accentColor: '#7c3aed',
        },
      }}
    >
      <App providerAppId={PROVIDER_APP_ID} />
    </PrivyProvider>
  </StrictMode>,
);
