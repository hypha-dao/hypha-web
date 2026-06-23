import { z } from 'zod';
import { proposeOrganisationBlueprint } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';

const inputSchema = z.object({
  organisation_name: z.string().trim().min(2).max(120),
  purpose: z.string().trim().min(10).max(2000),
  root_slug: z.string().trim().min(1).max(128),
  functional_domains: z
    .array(z.string().trim().min(2).max(60))
    .max(12)
    .optional(),
  include_liquidity_bridge: z.boolean().optional().default(true),
  include_ip_registry: z.boolean().optional().default(true),
  include_governance_space: z.boolean().optional().default(true),
  pattern_limit: z.number().int().min(5).max(100).optional().default(40),
});

export function createProposeOrganisationBlueprintTool() {
  return {
    description:
      'Plan-only organisational guidance: propose a multi-space ecosystem blueprint for a new organisation. Learns from network ecosystem patterns and returns draft nested spaces for user confirmation. Does not write or create spaces.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }

      const data = parsed.data;
      const rootSlug = sanitizeSlug(data.root_slug);
      if (!rootSlug) {
        return { ok: false, error: 'Invalid root slug.' };
      }

      try {
        const blueprint = await proposeOrganisationBlueprint(
          {
            organisation_name: data.organisation_name,
            purpose: data.purpose,
            root_slug: rootSlug,
            functional_domains: data.functional_domains,
            include_liquidity_bridge: data.include_liquidity_bridge,
            include_ip_registry: data.include_ip_registry,
            include_governance_space: data.include_governance_space,
            pattern_limit: data.pattern_limit,
          },
          { db },
        );

        return {
          ok: true,
          requires_confirmation: true,
          confirmation_token: 'confirm-ecosystem-blueprint',
          blueprint,
          next_step:
            'Present the proposed nested spaces clearly. After confirmation, create ONLY the root with create_space_from_onboarding. Nested spaces are created later in the left AI panel with create_ecosystem_space—one at a time.',
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { ok: false, error: message };
      }
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
