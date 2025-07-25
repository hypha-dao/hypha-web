import 'server-only';
import { Alchemy, Network } from 'alchemy-sdk';

const config = {
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
  connectionInfoOverrides: {
    skipFetchSetup: true,
  },
};

export function getAlchemy() {
  const alchemy = new Alchemy(config);
  return alchemy;
}
