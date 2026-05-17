import slugify from 'slugify';
import { z } from 'zod';
import {
  type Category,
  type SpaceFlags,
  checkSpaceAccessForSpace,
  createSpace,
  findSpaceBySlug,
  updateSpaceBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';
import {
  hasExplicitConfirmation,
  resolveActorPerson,
} from './onboarding-actor';
import { logOnboardingToolEvent } from './onboarding-observability';

const allowedSpaceFlags = ['sandbox', 'demo', 'archived'] as const;
const allowedCategories = [
  'art',
  'events',
  'arts',
  'biodiversity',
  'bioregions',
  'cities',
  'culture',
  'education',
  'emergency',
  'energy',
  'finance',
  'food',
  'gaming',
  'governance',
  'health',
  'housing',
  'innovation',
  'knowledge',
  'land',
  'media',
  'mobility',
  'networks',
  'ocean',
  'distribution',
  'goods',
  'services',
  'sport',
  'tech',
  'tourism',
  'villages',
  'water',
  'wellbeing',
] as const;
const spaceFlagSchema = z.enum(allowedSpaceFlags);
const categorySchema = z.enum(allowedCategories);

const inputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  slug: z.string().trim().min(1).max(128).optional(),
  parent_space_slug: z.string().trim().min(1).max(128).optional(),
  flags: z.array(spaceFlagSchema).optional().default([]),
  links: z.array(z.string().url()).optional().default([]),
  categories: z.array(categorySchema).optional().default([]),
  lead_image_url: z.string().url().optional(),
  logo_url: z.string().url().optional(),
  ecosystem_logo_light_url: z.string().url().optional(),
  ecosystem_logo_dark_url: z.string().url().optional(),
  onboarding_last_user_text: z.string().optional(),
  dry_run: z.boolean().optional().default(false),
});

export function createCreateSpaceFromOnboardingTool(authToken: string) {
  return {
    description:
      'Write: create a new Hypha space from onboarding input. Requires explicit user confirmation before execution and membership access checks when nested under a parent space.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) return { ok: false, error: parsed.error.message };
      const data = parsed.data;

      const safeSlug = data.slug ? sanitizeSlug(data.slug) : null;
      if (data.slug && !safeSlug) {
        return { ok: false, error: 'Invalid slug format.' };
      }
      const normalizedSlug =
        safeSlug ?? sanitizeSlug(slugify(data.title, { lower: true }));
      if (!normalizedSlug) {
        return {
          ok: false,
          error: 'Could not derive a valid slug from title.',
        };
      }
      const existing = await findSpaceBySlug({ slug: normalizedSlug }, { db });
      if (existing) {
        logOnboardingToolEvent({
          tool: 'create_space_from_onboarding',
          status: 'failed',
          spaceSlug: normalizedSlug,
          error: 'slug_already_exists',
        });
        return {
          ok: false,
          error: `A space with slug "${normalizedSlug}" already exists.`,
        };
      }

      const safeParentSlug = data.parent_space_slug
        ? sanitizeSlug(data.parent_space_slug)
        : null;
      if (data.parent_space_slug && !safeParentSlug) {
        return { ok: false, error: 'Invalid parent space slug format.' };
      }

      const parentSpace = safeParentSlug
        ? await findSpaceBySlug({ slug: safeParentSlug }, { db })
        : null;
      if (safeParentSlug && !parentSpace) {
        return {
          ok: false,
          error: `Parent space "${safeParentSlug}" was not found.`,
        };
      }
      if (parentSpace) {
        const access = await checkSpaceAccessForSpace(parentSpace, authToken);
        if (!access.hasAccess) {
          return { ok: false, error: access.message };
        }
      }

      const { person: creator, privyUserId } = await resolveActorPerson(
        authToken,
      );
      const explicitConfirmation = hasExplicitConfirmation(
        data.onboarding_last_user_text,
        'confirm-create-space',
      );

      if (data.dry_run || !explicitConfirmation) {
        logOnboardingToolEvent({
          tool: 'create_space_from_onboarding',
          status: 'proposed',
          actorSub: privyUserId,
          spaceSlug: normalizedSlug,
          dedupeKey: `create_space:${normalizedSlug}`,
        });
        return {
          ok: true,
          dry_run: true,
          requires_confirmation: true,
          confirmation_token: 'confirm-create-space',
          preview: {
            title: data.title,
            slug: normalizedSlug,
            parent_space_slug: safeParentSlug ?? null,
            flags: data.flags,
            links: data.links,
            categories: data.categories,
          },
          next_step: 'Confirm to create this space.',
        };
      }

      logOnboardingToolEvent({
        tool: 'create_space_from_onboarding',
        status: 'confirmed',
        actorSub: privyUserId,
        spaceSlug: normalizedSlug,
        dedupeKey: `create_space:${normalizedSlug}`,
      });

      const created = await createSpace(
        {
          title: data.title,
          description: data.description,
          slug: normalizedSlug,
          parentId: parentSpace?.id ?? null,
          flags: data.flags as SpaceFlags[],
          links: data.links,
          categories: data.categories as Category[],
          leadImage: data.lead_image_url,
          logoUrl: data.logo_url,
          ecosystemLogoUrlLight: data.ecosystem_logo_light_url,
          ecosystemLogoUrlDark: data.ecosystem_logo_dark_url,
        },
        { db },
      );

      if (!created.slug) {
        return {
          ok: false,
          error: 'Space was created but slug resolution failed.',
        };
      }

      const createdSlug = sanitizeSlug(created.slug) ?? created.slug;
      await updateSpaceBySlug(
        {
          slug: createdSlug,
          links: data.links,
          categories: data.categories as Category[],
          flags: data.flags as SpaceFlags[],
        },
        { db },
      );

      logOnboardingToolEvent({
        tool: 'create_space_from_onboarding',
        status: 'executed',
        actorSub: privyUserId,
        spaceSlug: createdSlug,
        dedupeKey: `create_space:${createdSlug}`,
        details: { parentSpaceSlug: safeParentSlug ?? null },
      });

      return {
        ok: true,
        space: {
          id: created.id,
          slug: createdSlug,
          title: created.title,
          parent_id: created.parentId ?? null,
        },
        audit: {
          actor_person_id: creator.id,
          actor_sub: privyUserId,
          action: 'create_space_from_onboarding',
          confirmed: true,
          rollback_hint: `Delete space "${createdSlug}" if this was created by mistake.`,
        },
      };
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
