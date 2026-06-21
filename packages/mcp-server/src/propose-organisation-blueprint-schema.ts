import { z } from 'zod';

export const proposeOrganisationBlueprintInputSchema = z.object({
  organisation_name: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .describe('Display name for the root organisation/ecosystem'),
  purpose: z
    .string()
    .trim()
    .min(10)
    .max(2000)
    .describe('What the organisation does and who it serves'),
  root_slug: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .describe('Slug key for the root space (sanitized internally)'),
  functional_domains: z
    .array(z.string().trim().min(2).max(60))
    .max(12)
    .optional()
    .describe(
      'Optional explicit functional domains to include as child spaces',
    ),
  include_liquidity_bridge: z.boolean().optional().default(true),
  include_ip_registry: z.boolean().optional().default(true),
  include_governance_space: z.boolean().optional().default(true),
  pattern_limit: z.number().int().min(5).max(100).optional().default(40),
});

const blueprintNodeSchema = z.object({
  key: z.string(),
  role: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.literal('planned'),
  inspired_by: z.array(z.string()).optional(),
});

export const proposeOrganisationBlueprintOutputSchema = z.object({
  ok: z.boolean(),
  blueprint: z
    .object({
      root_slug: z.string(),
      root_title: z.string(),
      nodes: z.array(blueprintNodeSchema),
      network_context: z.object({
        sampled_ecosystem_count: z.number(),
        frequent_child_title_keywords: z.array(z.string()),
      }),
    })
    .optional(),
  error: z.string().optional(),
});

export type ProposeOrganisationBlueprintInput = z.infer<
  typeof proposeOrganisationBlueprintInputSchema
>;
export type ProposeOrganisationBlueprintOutput = z.infer<
  typeof proposeOrganisationBlueprintOutputSchema
>;
