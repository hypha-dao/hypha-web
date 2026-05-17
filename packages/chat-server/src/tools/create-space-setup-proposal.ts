import { z } from 'zod';
import {
  checkSpaceAccessForSpace,
  createAgreement,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';
import {
  hasExplicitConfirmation,
  resolveActorPerson,
} from './onboarding-actor';
import { logOnboardingToolEvent } from './onboarding-observability';

const inputSchema = z.object({
  space_slug: z.string().trim().min(1),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(20).max(4000),
  label: z.string().trim().min(2).max(80).optional(),
  onboarding_last_user_text: z.string().optional(),
  require_confirmation_token: z
    .string()
    .trim()
    .min(3)
    .optional()
    .default('confirm-proposal'),
  dry_run: z.boolean().optional().default(false),
});

export function createCreateSpaceSetupProposalTool(authToken: string) {
  return {
    description:
      'Write: create a setup proposal document for a space. Requires explicit user confirmation token in latest user message.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) return { ok: false, error: parsed.error.message };
      const data = parsed.data;

      const safe = sanitizeSlug(data.space_slug);
      if (!safe) return { ok: false, error: 'Invalid space slug format.' };

      const host = await findSpaceBySlug({ slug: safe }, { db });
      if (!host) return { ok: false, error: `Space "${safe}" was not found.` };

      const access = await checkSpaceAccessForSpace(host, authToken);
      if (!access.hasAccess) return { ok: false, error: access.message };

      const { person, privyUserId } = await resolveActorPerson(authToken);
      const confirmationToken =
        data.require_confirmation_token ?? 'confirm-proposal';
      const confirmed = hasExplicitConfirmation(
        data.onboarding_last_user_text,
        confirmationToken,
      );

      if (!confirmed || data.dry_run) {
        logOnboardingToolEvent({
          tool: 'create_space_setup_proposal',
          status: 'proposed',
          actorSub: privyUserId,
          spaceSlug: safe,
          dedupeKey: `proposal:${safe}:${data.title.toLowerCase()}`,
        });
        return {
          ok: true,
          dry_run: true,
          requires_confirmation: true,
          confirmation_token: confirmationToken,
          preview: {
            space_slug: safe,
            title: data.title,
            label: data.label ?? 'space setup',
            description: data.description,
          },
          next_step: `Ask the user to reply with "${confirmationToken}" to create this proposal.`,
        };
      }

      logOnboardingToolEvent({
        tool: 'create_space_setup_proposal',
        status: 'confirmed',
        actorSub: privyUserId,
        spaceSlug: safe,
        dedupeKey: `proposal:${safe}:${data.title.toLowerCase()}`,
      });

      const created = await createAgreement(
        {
          title: data.title,
          description: data.description,
          state: 'proposal',
          spaceId: host.id,
          creatorId: person.id,
          label: data.label ?? 'space setup',
        },
        { db },
      );

      logOnboardingToolEvent({
        tool: 'create_space_setup_proposal',
        status: 'executed',
        actorSub: privyUserId,
        spaceSlug: safe,
        dedupeKey: `proposal:${safe}:${created.id}`,
        details: { proposalId: created.id, slug: created.slug ?? null },
      });

      return {
        ok: true,
        proposal: {
          id: created.id,
          slug: created.slug,
          title: created.title,
          state: created.state,
          label: created.label,
        },
        audit: {
          actor_person_id: person.id,
          actor_sub: privyUserId,
          action: 'create_space_setup_proposal',
          confirmed: true,
          rollback_hint: `Withdraw or archive proposal "${
            created.slug ?? created.id
          }".`,
        },
      };
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
