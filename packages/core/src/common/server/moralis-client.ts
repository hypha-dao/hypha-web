import 'server-only';

import { base } from 'viem/chains';
import Moralis from 'moralis';

let moralisInitPromise: Promise<typeof Moralis> | null = null;

export async function getMoralis(): Promise<typeof Moralis> {
  if (!Moralis.Core.isStarted) {
    if (!moralisInitPromise) {
      moralisInitPromise = Moralis.start({
        apiKey: process.env.MORALIS_API_KEY,
        defaultNetwork: base.id,
        defaultEvmApiChain: base.id,
      }).then(() => Moralis);
    }
    await moralisInitPromise;
  }
  return Moralis;
}
