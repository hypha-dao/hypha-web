import slugify from 'slugify';
import { z } from 'zod';
import {
  type Category,
  type SpaceFlags,
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
const httpUrlSchema = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'Only http/https URLs are allowed.',
  });

const inputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  slug: z.string().trim().min(1).max(128).optional(),
  parent_space_slug: z.string().trim().min(1).max(128).optional(),
  flags: z.array(spaceFlagSchema).optional().default([]),
  links: z.array(httpUrlSchema).optional().default([]),
  categories: z.array(categorySchema).optional().default([]),
  lead_image_url: httpUrlSchema.optional(),
  logo_url: httpUrlSchema.optional(),
  ecosystem_logo_light_url: httpUrlSchema.optional(),
  ecosystem_logo_dark_url: httpUrlSchema.optional(),
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

      return {
        ok: true,
        requires_wallet_signature: true,
        create_payload: {
          title: data.title,
          description: data.description,
          slug: normalizedSlug,
          parent_id: parentSpace?.id ?? null,
          parent_space_slug: safeParentSlug ?? null,
          flags: data.flags as SpaceFlags[],
          links: data.links,
          categories: data.categories as Category[],
          lead_image_url: data.lead_image_url ?? null,
          logo_url: data.logo_url ?? null,
          ecosystem_logo_light_url: data.ecosystem_logo_light_url ?? null,
          ecosystem_logo_dark_url: data.ecosystem_logo_dark_url ?? null,
        },
        next_step:
          'Ask the user to sign the on-chain space creation transaction. After wallet confirmation and receipt, persist the space in DB.',
        audit: {
          actor_person_id: creator.id,
          actor_sub: privyUserId,
          action: 'create_space_from_onboarding_handoff',
          confirmed: true,
        },
      };
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
