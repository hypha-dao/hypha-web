import { z } from 'zod';
import {
  checkSpaceAccessForSpace,
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
      const confirmationToken = data.require_confirmation_token;
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
          requires_confirmation: true,
          confirmation_token: confirmationToken,
          preview: {
            title: data.title,
            label: data.label ?? 'space setup',
            description: data.description,
          },
          next_step:
            'I need one more confirmation from you before the signing step. Press Confirm and then sign in your wallet to publish this proposal.',
        };
      }

      if (host.web3SpaceId == null) {
        return {
          ok: false,
          error:
            'This space is not linked to an on-chain DAO yet. Complete space activation before creating proposals.',
        };
      }

      logOnboardingToolEvent({
        tool: 'create_space_setup_proposal',
        status: 'confirmed',
        actorSub: privyUserId,
        spaceSlug: safe,
        dedupeKey: `proposal:${safe}:${data.title.toLowerCase()}`,
      });

      return {
        ok: true,
        requires_wallet_signature: true,
        create_payload: {
          title: data.title,
          description: data.description,
          space_id: host.id,
          web3_space_id: host.web3SpaceId,
          creator_id: person.id,
          label: data.label ?? 'space setup',
          space_slug: safe,
        },
        next_step:
          'Ask the user to sign the on-chain proposal transaction. After wallet confirmation, the proposal will appear under Agreements.',
        audit: {
          actor_person_id: person.id,
          actor_sub: privyUserId,
          action: 'create_space_setup_proposal_handoff',
          confirmed: true,
        },
      };
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
