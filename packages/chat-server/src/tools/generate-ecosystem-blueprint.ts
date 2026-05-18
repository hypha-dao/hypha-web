import { z } from 'zod';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';

const inputSchema = z.object({
  root_space_slug: z.string().trim().min(1),
  include_liquidity_bridge: z.boolean().optional().default(true),
  include_ip_registry: z.boolean().optional().default(true),
  include_governance_space: z.boolean().optional().default(true),
  custom_functional_domains: z
    .array(z.string().trim().min(2))
    .max(20)
    .optional()
    .default([]),
});

type BlueprintNode = {
  key: string;
  role:
    | 'community_hub'
    | 'core_team'
    | 'functional_domain'
    | 'liquidity_bridge'
    | 'ip_registry'
    | 'governance';
  title: string;
  description: string;
  status: 'planned';
};

export function createGenerateEcosystemBlueprintTool() {
  return {
    description:
      'Plan-only: generate a draft ecosystem blueprint graph from a root space. Returns proposed nodes for user confirmation; does not write.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) return { ok: false, error: parsed.error.message };
      const data = parsed.data;
      const rootSlug = sanitizeSlug(data.root_space_slug);
      if (!rootSlug) return { ok: false, error: 'Invalid root space slug.' };

      const nodes: BlueprintNode[] = [
        {
          key: `${rootSlug}-community`,
          role: 'community_hub',
          title: 'Community Hub',
          description: 'Open collaboration and contributor coordination space.',
          status: 'planned',
        },
        {
          key: `${rootSlug}-core-team`,
          role: 'core_team',
          title: 'Core Team',
          description: 'Execution-focused operator space for day-to-day work.',
          status: 'planned',
        },
      ];

      const domains =
        data.custom_functional_domains.length > 0
          ? data.custom_functional_domains
          : ['Finance', 'Operations', 'Growth'];
      for (const domain of domains) {
        const key =
          sanitizeSlug(`${rootSlug}-${domain}`) ?? `${rootSlug}-${domain}`;
        nodes.push({
          key,
          role: 'functional_domain',
          title: `${domain} Domain`,
          description: `Functional domain space for ${domain.toLowerCase()} governance and proposals.`,
          status: 'planned',
        });
      }

      if (data.include_liquidity_bridge) {
        nodes.push({
          key: `${rootSlug}-liquidity-bridge`,
          role: 'liquidity_bridge',
          title: 'Liquidity Bridge',
          description: 'Treasury coordination and liquidity strategy space.',
          status: 'planned',
        });
      }
      if (data.include_ip_registry) {
        nodes.push({
          key: `${rootSlug}-ip-registry`,
          role: 'ip_registry',
          title: 'IP Registry',
          description: 'Intellectual property and licensing governance space.',
          status: 'planned',
        });
      }
      if (data.include_governance_space) {
        nodes.push({
          key: `${rootSlug}-governance`,
          role: 'governance',
          title: 'Governance Council',
          description: 'Cross-space governance standards and escalation space.',
          status: 'planned',
        });
      }

      return {
        ok: true,
        dry_run: true,
        requires_confirmation: true,
        confirmation_token: 'confirm-ecosystem-blueprint',
        blueprint: {
          root_space_slug: rootSlug,
          nodes,
          edges: nodes.map((node) => ({
            from: rootSlug,
            to: node.key,
            relation: 'parent_of',
          })),
        },
        next_step:
          'Review the blueprint nodes. Confirm the blueprint, then create spaces one by one with create_ecosystem_space.',
      };
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
