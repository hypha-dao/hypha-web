import { base } from 'viem/chains';
import Moralis from 'moralis';

async function getMoralis() {
  if (!Moralis.Core.isStarted) {
    await Moralis.start({
      apiKey: process.env.MORALIS_API_KEY,
      defaultNetwork: base.id,
      defaultEvmApiChain: base.id,
    });
  }

  return Moralis;
}

export const moralisClient: typeof Moralis = await getMoralis();
