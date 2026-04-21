# Hypha Wallet QR Code Guide (New System)

This is a simple guide for generating and using Hypha Wallet QR codes with the current callback system.

## What changed

- The callback service now points to Vercel instead of the old AWS host.
- Current callback host:
  - `https://hypha-migration-api-vladislav-hramtsovs-projects.vercel.app`

## Endpoints used by QR flow

- Store signed transaction ID:
  - `POST /transaction?uid=<UID>&tx_id=<TX_ID>`
- Poll for signed transaction ID:
  - `GET /transaction/<UID>`

Example full URLs:

- `https://hypha-migration-api-vladislav-hramtsovs-projects.vercel.app/transaction?uid=abc&tx_id=0x123`
- `https://hypha-migration-api-vladislav-hramtsovs-projects.vercel.app/transaction/abc`

## How QR signing works

1. Generate a unique `uid`.
2. Build an ESR request with callback:
   - `https://hypha-migration-api-vladislav-hramtsovs-projects.vercel.app/transaction?uid=<uid>&tx_id={{tx}}`
3. Convert ESR string to QR code image.
4. User scans QR in Hypha Wallet and signs.
5. Wallet calls `POST /transaction?...` with the actual transaction id.
6. Web app polls `GET /transaction/<uid>` until tx id is returned.
7. Fetch/verify transaction on chain and continue app flow.

## Recommended way (use existing library)

Use `@hypha-dao/ual-hypha` and let it handle ESR + QR + polling.

```js
import { UAL } from 'universal-authenticator-library';
import { HyphaAuthenticator } from '@hypha-dao/ual-hypha';

const chain = {
  chainId: '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11',
  rpcEndpoints: [{ protocol: 'https', host: 'mainnet.telos.net', port: 443 }],
};

const hyphaAuth = new HyphaAuthenticator([chain], {
  appName: 'YourAppName',
  translation: {
    login: {
      title: 'Login',
      text: 'Scan the QR-code with Hypha Wallet on your mobile device',
      actionText: 'Launch On Desktop',
    },
  },
});

const ual = new UAL([chain], 'YourAppName', [hyphaAuth]);
await hyphaAuth.init();
const users = await hyphaAuth.login();
```

## If you need to construct QR manually

### 1) Build callback URL

```txt
https://hypha-migration-api-vladislav-hramtsovs-projects.vercel.app/transaction?uid=<uid>&tx_id={{tx}}
```

### 2) Encode ESR with `background: true`

Use your existing ESR utility to encode actions with callback.

### 3) Convert ESR string to QR image

```js
import QRCode from 'qrcode';

const qrDataUrl = await QRCode.toDataURL(esrString, {
  color: {
    dark: '#ffffff',
    light: '#131C32',
  },
});
```

### 4) Poll callback endpoint

```js
const pollUrl = `https://hypha-migration-api-vladislav-hramtsovs-projects.vercel.app/transaction/${uid}`;
// poll until endpoint returns tx id (HTTP 200, plain text)
```

## Quick API test commands

```bash
# Store tx id
curl -X POST "https://hypha-migration-api-vladislav-hramtsovs-projects.vercel.app/transaction?uid=test123&tx_id=abc456"

# Retrieve tx id
curl "https://hypha-migration-api-vladislav-hramtsovs-projects.vercel.app/transaction/test123"
```

Expected second response:

```txt
abc456
```

## Notes

- Callback entries are short-lived (TTL) and meant for sign-and-return flow.
- Keep using unique `uid` values per signing request.
- If polling returns not found, continue polling until timeout.
