import { z } from 'zod';

export const getEcosystemBySpaceSlugInputSchema = z.object({
  space_slug: z
    .string()
    .trim()
    .min(1)
    .describe('Hypha space slug of the active space'),
  include_archived: z.boolean().optional().default(false),
});

const ecosystemSpaceSchema = z.object({
  id: z.number(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  parent_id: z.number().nullable(),
  web3_space_id: z.number().nullable(),
  member_count: z.number(),
  document_count: z.number(),
  is_archived: z.boolean(),
  flags: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
  child_space_ids: z.array(z.number()),
});

export const getEcosystemBySpaceSlugOutputSchema = z.object({
  found: z.boolean(),
  space_slug: z.string(),
  root_space_slug: z.string().optional(),
  root_space_id: z.number().optional(),
  ecosystem: z
    .object({
      space_count: z.number(),
      edge_count: z.number(),
    })
    .optional(),
  spaces: z.array(ecosystemSpaceSchema).optional(),
  error: z.string().optional(),
});

export type GetEcosystemBySpaceSlugInput = z.infer<
  typeof getEcosystemBySpaceSlugInputSchema
>;
export type GetEcosystemBySpaceSlugOutput = z.infer<
  typeof getEcosystemBySpaceSlugOutputSchema
>;
