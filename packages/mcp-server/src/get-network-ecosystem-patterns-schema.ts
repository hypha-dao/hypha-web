import { z } from 'zod';

export const getNetworkEcosystemPatternsInputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(40)
    .describe('Maximum number of ecosystem samples to return'),
  min_child_count: z
    .number()
    .int()
    .min(2)
    .max(50)
    .optional()
    .default(2)
    .describe('Minimum child spaces required for an ecosystem to be included'),
});

const ecosystemSampleSchema = z.object({
  root_slug: z.string(),
  root_title: z.string(),
  space_count: z.number(),
  child_titles: z.array(z.string()),
  categories: z.array(z.string()),
  inferred_roles: z.array(z.string()),
});

export const getNetworkEcosystemPatternsOutputSchema = z.object({
  ok: z.boolean(),
  sampled_ecosystem_count: z.number().optional(),
  total_ecosystems_with_children: z.number().optional(),
  average_child_count: z.number().optional(),
  common_role_counts: z.record(z.string(), z.number()).optional(),
  frequent_child_title_keywords: z.array(z.string()).optional(),
  samples: z.array(ecosystemSampleSchema).optional(),
  error: z.string().optional(),
});

export type GetNetworkEcosystemPatternsInput = z.infer<
  typeof getNetworkEcosystemPatternsInputSchema
>;
export type GetNetworkEcosystemPatternsOutput = z.infer<
  typeof getNetworkEcosystemPatternsOutputSchema
>;
