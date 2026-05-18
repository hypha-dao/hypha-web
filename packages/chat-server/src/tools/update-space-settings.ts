import { z } from 'zod';
import {
  type SpaceFlags,
  checkSpaceAccessForSpace,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { updateSpaceBySlug } from '@hypha-platform/core/server';
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
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(10).max(2000).optional(),
  links: z.array(z.string().url()).optional(),
  flags: z.array(z.enum(['sandbox', 'demo', 'archived'])).optional(),
  require_confirmation_token: z
    .string()
    .trim()
    .min(3)
    .optional()
    .default('confirm-update'),
  dry_run: z.boolean().optional().default(false),
});

export function createUpdateSpaceSettingsTool(
  authToken: string,
  trustedLastUserText?: string,
) {
  return {
    description:
      'Write: update top-level space settings (title, description, links, flags) for onboarding setup. Requires explicit user confirmation token in the latest user turn.',
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

      const hasChanges =
        data.title !== undefined ||
        data.description !== undefined ||
        data.links !== undefined ||
        data.flags !== undefined;
      if (!hasChanges) {
        return { ok: false, error: 'No settings provided to update.' };
      }

      const confirmationToken =
        data.require_confirmation_token ?? 'confirm-update';
      const confirmed = hasExplicitConfirmation(
        trustedLastUserText,
        confirmationToken,
      );

      if (!confirmed || data.dry_run) {
        logOnboardingToolEvent({
          tool: 'update_space_settings',
          status: 'proposed',
          actorSub: privyUserId,
          spaceSlug: safe,
          dedupeKey: `update_space:${safe}`,
        });
        return {
          ok: true,
          dry_run: true,
          requires_confirmation: true,
          confirmation_token: confirmationToken,
          preview: {
            space_slug: safe,
            title: data.title ?? host.title,
            description: data.description ?? host.description,
            links: data.links ?? host.links ?? [],
            flags: data.flags ?? host.flags ?? [],
          },
          next_step: `Ask the user to reply with "${confirmationToken}" to apply these settings.`,
        };
      }

      logOnboardingToolEvent({
        tool: 'update_space_settings',
        status: 'confirmed',
        actorSub: privyUserId,
        spaceSlug: safe,
        dedupeKey: `update_space:${safe}`,
      });

      const updated = await updateSpaceBySlug(
        {
          slug: safe,
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.description !== undefined
            ? { description: data.description }
            : {}),
          ...(data.links !== undefined ? { links: data.links } : {}),
          ...(data.flags !== undefined
            ? { flags: data.flags as SpaceFlags[] }
            : {}),
        },
        { db },
      );

      logOnboardingToolEvent({
        tool: 'update_space_settings',
        status: 'executed',
        actorSub: privyUserId,
        spaceSlug: updated.slug,
        dedupeKey: `update_space:${updated.slug}`,
      });

      return {
        ok: true,
        space: {
          id: updated.id,
          slug: updated.slug,
          title: updated.title,
        },
        audit: {
          actor_person_id: person.id,
          actor_sub: privyUserId,
          action: 'update_space_settings',
          confirmed: true,
          rollback_hint: 'Re-run update_space_settings with previous values.',
        },
      };
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
