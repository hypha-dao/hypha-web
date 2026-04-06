import React from 'react';
import ReactDOM from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import App from './App';

const CONSUMER_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;

if (!CONSUMER_APP_ID) {
  throw new Error(
    'Missing VITE_PRIVY_APP_ID — create a .env file with your consumer Privy app ID',
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PrivyProvider
      appId={CONSUMER_APP_ID}
      config={{
        loginMethodsAndOrder: {
          primary: ['email', 'wallet'],
        },
        appearance: {
          theme: 'dark',
          accentColor: '#7C3AED',
        },
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>,
);
