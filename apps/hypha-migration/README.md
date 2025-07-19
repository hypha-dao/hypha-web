# Hypha Token Migration Suite

A complete solution for HYPHA token migration from Telos to Base network, including frontend interface and backend API for HYPHA token minting.

## Projects

### 🌐 [hypha-react-demo](./hypha-react-demo/)

**Frontend Migration Interface**

- React-based UI for HYPHA token migration
- Integrates with Hypha Wallet for Telos transactions
- Clean, modern interface for migration process
- Built with Vite for fast development

### 🔧 [hypha-migration-api](./hypha-migration-api/)

**Backend API Service**

- Verifies HYPHA migration completion on Telos
- Executes HYPHA token minting on Base mainnet
- Multiple verification methods (migration table, transaction ID, hybrid)
- Serverless deployment ready for Vercel

## Quick Start

### Frontend (hypha-react-demo)

```bash
cd hypha-react-demo
npm install
npm run dev
```

### Backend API (hypha-migration-api)

```bash
cd hypha-migration-api
# Set up environment variables (see ENVIRONMENT.md)
vercel dev
```

## Deployment

### Frontend

Deploy to Vercel/Netlify from the `hypha-react-demo` directory.

### Backend API

Deploy to Vercel from the `hypha-migration-api` directory with these environment variables:

- `PRIVATE_KEY`: Base mainnet wallet private key (authorized for HYPHA minting)
- `NODE_ENV`: production

## Features

- ✅ **Complete Migration Flow**: From Telos transaction to Base verification
- ✅ **Wallet Integration**: Seamless Hypha Wallet connectivity
- ✅ **Multiple Verification**: Table verification with transaction fallback
- ✅ **Production Ready**: Serverless backend, optimized frontend
- ✅ **Automated Minting**: HYPHA tokens minted after verified migration

## Architecture

```
Frontend (React) → Hypha Wallet → Telos Migration Contract
     ↓
Migration API → Verify on Telos → Execute HYPHA Mint on Base
```

## Documentation

- [Frontend README](./hypha-react-demo/README.md)
- [API Documentation](./hypha-migration-api/README.md)
- [Environment Setup](./hypha-migration-api/ENVIRONMENT.md)

## License

MIT License
