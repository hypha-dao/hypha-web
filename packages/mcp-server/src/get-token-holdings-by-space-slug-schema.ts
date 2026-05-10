import { z } from 'zod';
import { slugSchema } from './common-schemas.js';

export const getTokenHoldingsBySpaceSlugInputSchema = z.object({
  space_slug: slugSchema,
  include_zero_balances: z.boolean().optional().default(false),
  holder_limit: z.number().int().min(1).max(1000).optional(),
  include_treasury: z.boolean().optional().default(true),
});

const holderSchema = z.object({
  holder_kind: z.enum(['person', 'space', 'treasury', 'other']),
  address: z.string().nullable(),
  display_name: z.string(),
  slug: z.string().nullable(),
  balance: z.string(),
  balance_raw: z.string(),
  share_pct: z.number(),
});

const tokenHoldingSchema = z.object({
  token_id: z.number().nullable(),
  token_address: z.string(),
  name: z.string(),
  symbol: z.string(),
  icon_url: z.string().nullable(),
  type: z.string(),
  decimals: z.number(),
  max_supply: z.union([z.string(), z.number()]).nullable(),
  total_supply: z.string(),
  holdings: z.array(holderSchema),
  treasury_balance: z.string(),
  other_balance: z.string(),
  total_holders_balance: z.string(),
});

export const getTokenHoldingsBySpaceSlugOutputSchema = z.object({
  found: z.boolean(),
  space_slug: z.string(),
  space: z
    .object({
      id: z.number(),
      slug: z.string(),
      title: z.string(),
      parent_id: z.number().nullable(),
      web3_space_id: z.number().nullable(),
    })
    .nullable(),
  source: z.literal('db+chain'),
  asOf: z.string(),
  tokens: z.array(tokenHoldingSchema),
});
