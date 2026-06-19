import slugify from 'slugify';
import { z } from 'zod';
import {
  type Category,
  type SpaceFlags,
  checkSpaceAccessForSpace,
  findSpaceBySlug,
  searchNominatim,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';
import {
  hasOnboardingConfirmation,
  hasRecentVisualGenerationRequest,
  inferVisualVibe,
} from './onboarding-confirmation';
import { generateSpaceVisualAssets } from './generate-space-visual-assets';
import { isSkippedLocationAnswer } from './onboarding-location';
import { resolveActorPerson } from './onboarding-actor';
import { logOnboardingToolEvent } from './onboarding-observability';

type ResolvedLocationSource = 'geocode' | 'manual' | 'map_click';

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
  description: z.string().trim().min(10).max(300),
  slug: z.string().trim().min(1).max(128).optional(),
  parent_space_slug: z.string().trim().min(1).max(128).optional(),
  parent_space_name: z.string().trim().min(1).max(180).optional(),
  flags: z.array(spaceFlagSchema).optional().default([]),
  links: z.array(httpUrlSchema).optional().default([]),
  categories: z.array(categorySchema).optional().default([]),
  lead_image_url: httpUrlSchema.optional(),
  logo_url: httpUrlSchema.optional(),
  generate_visuals: z.boolean().optional().default(false),
  visual_vibe: z.string().trim().min(1).max(200).optional(),
  location_query: z.string().trim().min(2).max(500).optional(),
  location_label: z.string().trim().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  location_source: z.enum(['geocode', 'manual', 'map_click']).optional(),
  ecosystem_logo_light_url: httpUrlSchema.optional(),
  ecosystem_logo_dark_url: httpUrlSchema.optional(),
  onboarding_last_user_text: z.string().optional(),
  onboarding_recent_user_texts: z.array(z.string()).optional(),
  onboarding_setup_phase: z.string().optional(),
  dry_run: z.boolean().optional().default(false),
});

async function resolveSpaceLocationFields(
  data: z.infer<typeof inputSchema>,
): Promise<
  | {
      ok: true;
      latitude: number | null;
      longitude: number | null;
      locationLabel: string | null;
      locationSource: ResolvedLocationSource | null;
    }
  | { ok: false; error: string }
> {
  const latitude =
    data.latitude === undefined ? null : (data.latitude as number | null);
  const longitude =
    data.longitude === undefined ? null : (data.longitude as number | null);
  const locationLabel = data.location_label?.trim() ?? null;
  const locationSource = data.location_source ?? null;

  if (latitude != null && longitude != null) {
    return {
      ok: true,
      latitude,
      longitude,
      locationLabel,
      locationSource: locationSource ?? 'geocode',
    };
  }

  const query = data.location_query?.trim();
  if (!query || isSkippedLocationAnswer(query)) {
    return {
      ok: true,
      latitude: null,
      longitude: null,
      locationLabel: null,
      locationSource: null,
    };
  }

  const results = await searchNominatim(query, 1);
  if (results.length === 0) {
    return {
      ok: false,
      error: `Could not find a location matching "${query}". Ask the user to rephrase with a city, region, or country.`,
    };
  }

  const best = results[0]!;
  return {
    ok: true,
    latitude: best.latitude,
    longitude: best.longitude,
    locationLabel: locationLabel ?? best.label,
    locationSource: locationSource ?? 'geocode',
  };
}

export function createCreateSpaceFromOnboardingTool(authToken: string) {
  return {
    description:
      'Write: create a new Hypha space from onboarding input. Requires explicit user confirmation before execution and membership access checks when nested under a parent space. When the user wants AI-generated icon/logo or banner images, set generate_visuals=true (or call generate_space_visual_assets first and pass logo_url and lead_image_url). Never tell the user that images must wait until after creation. When the user sets location via the onboarding map UI, latitude, longitude, and location_label are already in conversation context—pass them through without calling geocode_space_location. For typed place names only, call geocode_space_location first, confirm the match, then pass latitude, longitude, and location_label (or location_query for auto-resolution).',
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

      const parentSlugFromName = data.parent_space_name
        ? sanitizeSlug(slugify(data.parent_space_name, { lower: true }))
        : null;
      const requestedParentSlug = data.parent_space_slug ?? parentSlugFromName;
      const safeParentSlug = requestedParentSlug
        ? sanitizeSlug(requestedParentSlug)
        : null;
      if (requestedParentSlug && !safeParentSlug) {
        return { ok: false, error: 'Invalid parent space reference.' };
      }

      const parentSpace = safeParentSlug
        ? await findSpaceBySlug({ slug: safeParentSlug }, { db })
        : null;
      if (safeParentSlug && !parentSpace) {
        return {
          ok: false,
          error:
            data.parent_space_name && !data.parent_space_slug
              ? `Could not find a parent space matching "${data.parent_space_name}". Please share the exact parent space name.`
              : `Parent space "${safeParentSlug}" was not found.`,
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
      const explicitConfirmation = hasOnboardingConfirmation(
        {
          lastUserText: data.onboarding_last_user_text,
          recentUserTexts: data.onboarding_recent_user_texts,
          setupPhase: data.onboarding_setup_phase,
        },
        'confirm-create-space',
      );

      let logoUrl = data.logo_url ?? null;
      let leadImageUrl = data.lead_image_url ?? null;
      const shouldGenerateVisuals =
        data.generate_visuals ||
        hasRecentVisualGenerationRequest(data.onboarding_recent_user_texts) ||
        ((!logoUrl || !leadImageUrl) &&
          hasRecentVisualGenerationRequest([
            data.onboarding_last_user_text ?? '',
          ]));

      if (shouldGenerateVisuals && (!logoUrl || !leadImageUrl)) {
        const generated = await generateSpaceVisualAssets({
          space_name: data.title,
          space_purpose: data.description,
          visual_vibe: inferVisualVibe({
            visualVibe: data.visual_vibe,
            description: data.description,
            title: data.title,
          }),
          asset_kind:
            !logoUrl && !leadImageUrl ? 'both' : !logoUrl ? 'logo' : 'banner',
        });
        if (!generated.ok) {
          return { ok: false, error: generated.error };
        }
        logoUrl = logoUrl ?? generated.logo_url ?? null;
        leadImageUrl = leadImageUrl ?? generated.lead_image_url ?? null;
      }

      const locationFields = await resolveSpaceLocationFields(data);
      if (!locationFields.ok) {
        return { ok: false, error: locationFields.error };
      }

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
          requires_confirmation: true,
          confirmation_token: 'confirm-create-space',
          preview: {
            title: data.title,
            description: data.description,
            parent_space_name: data.parent_space_name ?? null,
            flags: data.flags,
            links: data.links,
            categories: data.categories,
            logo_url: logoUrl,
            lead_image_url: leadImageUrl,
            location_label: locationFields.locationLabel,
            latitude: locationFields.latitude,
            longitude: locationFields.longitude,
          },
          next_step: explicitConfirmation
            ? 'Confirmation received. Re-run this tool without dry_run to start wallet signing.'
            : 'I need one more confirmation from you before the signing step. Press Confirm and then sign in your wallet to create this space.',
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
          lead_image_url: leadImageUrl,
          logo_url: logoUrl,
          latitude: locationFields.latitude,
          longitude: locationFields.longitude,
          location_label: locationFields.locationLabel,
          location_source: locationFields.locationSource,
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
