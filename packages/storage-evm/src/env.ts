import { z } from 'zod';

const envVariables = z.object({
  // Base
  BASE_MAINNET_RPC_URL: z.string().url().default('https://mainnet.base.org'),
  BASE_SEPOLIA_RPC_URL: z.string().url().default('https://sepolia.base.org'),
  PRIVATE_KEY: z.string().min(1),
});

export const env = envVariables.parse(process.env);
