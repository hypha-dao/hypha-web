import { z } from 'zod';

const envVariables = z.object({
  MAINNET_RPC_URL: z.string().url(),
  SEPOLIA_RPC_URL: z.string().url(),
  BASE_MAINNET_RPC_URL: z.string().url().default('https://mainnet.base.org'),
  BASE_SEPOLIA_RPC_URL: z.string().url().default('https://sepolia.base.org'),
  // Base
  MATIC_RPC_URL: z.string().url(),
  // Polygon
  MUMBAI_RPC_URL: z.string().url(),
  // Blockchain explorers
  ETHERSCAN_API_KEY: z.string().min(1),
  POLYGONSCAN_API_KEY: z.string().min(1),
  // Import MNEMONIC or single private key
  MNEMONIC: z.string().default('your mnemonic'),
  PRIVATE_KEY: z.string().min(1),
});

export const env = envVariables.parse(process.env);
