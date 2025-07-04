import { z } from 'zod';

export const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export const recipientField = z
  .string()
  .min(1, { message: 'Recipient is required' })
  .regex(ETH_ADDRESS_REGEX, { message: 'Invalid Ethereum address' });

export const recipientFieldSchema = z.object({ recipient: recipientField });
