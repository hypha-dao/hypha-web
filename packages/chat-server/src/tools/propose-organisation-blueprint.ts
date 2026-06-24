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
        const rootSlug =
          sanitizeSlug(data.root_slug) ||
          sanitizeSlug(data.organisation_name) ||
          'organisation';
        return {
          ok: true,
          degraded: true,
          warning: message,
          requires_confirmation: true,
          confirmation_token: 'confirm-ecosystem-blueprint',
          blueprint: {
            root_slug: rootSlug,
            root_title: data.organisation_name.trim(),
            nodes: [
              {
                key: `${rootSlug}-community`,
                role: 'community_hub',
                title: 'Community Hub',
                description:
                  'Open collaboration space for contributors, members, and public coordination.',
                status: 'planned',
              },
              {
                key: `${rootSlug}-core-team`,
                role: 'core_team',
                title: 'Core Team',
                description:
                  'Operator space for day-to-day execution, staffing, and internal decisions.',
                status: 'planned',
              },
              ...(data.functional_domains ?? ['Operations', 'Growth']).map(
                (domain) => ({
                  key: `${rootSlug}-${domain
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')}`,
                  role: 'functional_domain' as const,
                  title: `${domain} Domain`,
                  description: `Functional domain for ${domain.toLowerCase()} proposals, agreements, and stewardship.`,
                  status: 'planned' as const,
                }),
              ),
            ],
            network_context: {
              sampled_ecosystem_count: 0,
              frequent_child_title_keywords: [],
            },
          },
          next_step:
            'Network pattern lookup was unavailable—propose a sensible default blueprint from purpose and any web research, then ask if the direction feels right.',
        };
      }
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
