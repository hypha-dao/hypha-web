import slugify from 'slugify';
import { z } from 'zod';
import {
  type Category,
  type SpaceFlags,
  checkSpaceAccessForSpace,
  createSpace,
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
import {
  createOnboardingCategoriesSchema,
  resolveOnboardingCategories,
} from './onboarding-categories';
import { buildSpaceScreenNavigation } from './space-screen-navigation';

const inputSchema = z.object({
  parent_space_slug: z.string().trim().min(1),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  slug: z.string().trim().min(1).max(128).optional(),
  role_in_ecosystem: z
    .enum([
      'community_hub',
      'core_team',
      'functional_domain',
      'liquidity_bridge',
      'ip_registry',
      'governance',
      'other',
    ])
    .default('other'),
  links: z.array(z.string().url()).optional().default([]),
  categories: createOnboardingCategoriesSchema(),
  flags: z
    .array(z.enum(['sandbox', 'demo', 'archived']))
    .optional()
    .default([]),
  onboarding_last_user_text: z.string().optional(),
  require_confirmation_token: z
    .string()
    .trim()
    .min(3)
    .optional()
    .default('confirm-ecosystem-space'),
  dry_run: z.boolean().optional().default(false),
  lang: z
    .string()
    .trim()
    .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
    .optional(),
});

const roleLabels: Record<
  z.infer<typeof inputSchema>['role_in_ecosystem'],
  string
> = {
  community_hub: 'community hub',
  core_team: 'core team',
  functional_domain: 'functional domain',
  liquidity_bridge: 'liquidity bridge',
  ip_registry: 'IP registry',
  governance: 'governance',
  other: 'ecosystem space',
};

export function createCreateEcosystemSpaceTool(
  authToken: string,
  defaultLocale?: string | null,
) {
  return {
    description:
      'Write: create a new nested space under a parent as part of ecosystem scaffolding. Requires explicit confirmation token. Returns navigation metadata so the app opens the new space after creation.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) return { ok: false, error: parsed.error.message };
      const categories =
        parsed.data.categories.length > 0
          ? parsed.data.categories
          : resolveOnboardingCategories(
              [],
              `${parsed.data.title} ${parsed.data.description}`,
            );
      const data = { ...parsed.data, categories };

      const safeParent = sanitizeSlug(data.parent_space_slug);
      if (!safeParent)
        return { ok: false, error: 'Invalid parent space slug.' };
      const safeSlug = data.slug ? sanitizeSlug(data.slug) : null;
      if (data.slug && !safeSlug)
        return { ok: false, error: 'Invalid slug format.' };
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
          tool: 'create_ecosystem_space',
          status: 'failed',
          spaceSlug: normalizedSlug,
          error: 'slug_already_exists',
        });
        return {
          ok: false,
          error: `A space with slug "${normalizedSlug}" already exists.`,
        };
      }

      const parent = await findSpaceBySlug({ slug: safeParent }, { db });
      if (!parent) {
        return {
          ok: false,
          error: `Parent space "${safeParent}" was not found.`,
        };
      }

      const access = await checkSpaceAccessForSpace(parent, authToken);
      if (!access.hasAccess) return { ok: false, error: access.message };

      const { person, privyUserId } = await resolveActorPerson(authToken);
      const confirmationToken = data.require_confirmation_token;
      const confirmed = hasExplicitConfirmation(
        data.onboarding_last_user_text,
        confirmationToken,
      );

      if (!confirmed || data.dry_run) {
        logOnboardingToolEvent({
          tool: 'create_ecosystem_space',
          status: 'proposed',
          actorSub: privyUserId,
          spaceSlug: normalizedSlug,
          dedupeKey: `ecosystem_space:${normalizedSlug}`,
        });
        return {
          ok: true,
          requires_confirmation: true,
          confirmation_token: confirmationToken,
          preview: {
            title: data.title,
            role_in_ecosystem: data.role_in_ecosystem,
            role_label: roleLabels[data.role_in_ecosystem],
            links: data.links,
            categories: data.categories,
            flags: data.flags,
          },
          next_step:
            'Please confirm once more and I will create this ecosystem space.',
        };
      }

      logOnboardingToolEvent({
        tool: 'create_ecosystem_space',
        status: 'confirmed',
        actorSub: privyUserId,
        spaceSlug: normalizedSlug,
        dedupeKey: `ecosystem_space:${normalizedSlug}`,
      });

      const created = await createSpace(
        {
          title: data.title,
          description: data.description,
          slug: normalizedSlug,
          parentId: parent.id,
          links: data.links,
          categories: data.categories as Category[],
          flags: data.flags as SpaceFlags[],
        },
        { db },
      );

      const createdSlug = sanitizeSlug(created.slug) ?? created.slug;

      logOnboardingToolEvent({
        tool: 'create_ecosystem_space',
        status: 'executed',
        actorSub: privyUserId,
        spaceSlug: createdSlug,
        dedupeKey: `ecosystem_space:${createdSlug}`,
        details: {
          role: data.role_in_ecosystem,
          parentSpaceSlug: safeParent,
        },
      });

      return {
        ok: true,
        space: {
          id: created.id,
          slug: createdSlug,
          title: created.title,
          parent_id: created.parentId ?? null,
          role_in_ecosystem: data.role_in_ecosystem,
          role_label: roleLabels[data.role_in_ecosystem],
        },
        navigation: buildSpaceScreenNavigation({
          lang: data.lang ?? defaultLocale ?? undefined,
          spaceSlug: createdSlug,
          screen: 'overview',
          label: `Open ${created.title}`,
        }),
        audit: {
          actor_person_id: person.id,
          actor_sub: privyUserId,
          action: 'create_ecosystem_space',
          confirmed: true,
          rollback_hint: `Delete ecosystem space "${createdSlug}" if needed.`,
        },
      };
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
