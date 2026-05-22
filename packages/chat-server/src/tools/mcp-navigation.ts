import { z } from 'zod';
import {
  checkSpaceAccessForSpace,
  findAllSpaces,
  findSpaceBySlug,
  getAllOrganizationSpacesForNodeById,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';

const destinationTypeSchema = z.enum([
  'space',
  'space_screen',
  'ecosystem_space',
  'app_screen',
  'website',
]);

const spaceScreenSchema = z.enum([
  'overview',
  'ecosystem_navigation',
  'signals',
  'agreements',
  'members',
  'treasury',
  'rewards',
  'memory',
  'space_configuration',
]);

const appScreenSchema = z.enum([
  'onboarding',
  'network',
  'my_spaces',
  'create_space',
  'profile_signup',
]);

const langSchema = z
  .string()
  .trim()
  .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
  .optional();

const httpUrlSchema = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'Only http/https URLs are allowed.',
  });

const inputSchema = z
  .object({
    destination_type: destinationTypeSchema,
    space_slug: z.string().trim().min(1).max(128).optional(),
    source_space_slug: z.string().trim().min(1).max(128).optional(),
    target_space_query: z.string().trim().min(1).max(180).optional(),
    context_hint: z.string().trim().min(1).max(500).optional(),
    space_screen: spaceScreenSchema.optional(),
    app_screen: appScreenSchema.optional(),
    website_url: httpUrlSchema.optional(),
    lang: langSchema,
    label: z.string().trim().min(1).max(120).optional(),
    open_in_new_tab: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.destination_type === 'space') {
      if (!value.space_slug) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['space_slug'],
          message: 'space_slug is required when destination_type is "space".',
        });
      }
      return;
    }
    if (value.destination_type === 'space_screen') {
      if (!value.space_slug) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['space_slug'],
          message:
            'space_slug is required when destination_type is "space_screen".',
        });
      }
      if (!value.space_screen) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['space_screen'],
          message:
            'space_screen is required when destination_type is "space_screen".',
        });
      }
      return;
    }
    if (value.destination_type === 'ecosystem_space') {
      if (!value.target_space_query) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['target_space_query'],
          message:
            'target_space_query is required when destination_type is "ecosystem_space".',
        });
      }
      return;
    }
    if (value.destination_type === 'app_screen') {
      if (!value.app_screen) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['app_screen'],
          message:
            'app_screen is required when destination_type is "app_screen".',
        });
      }
      return;
    }
    if (value.destination_type === 'website' && !value.website_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['website_url'],
        message: 'website_url is required when destination_type is "website".',
      });
    }
  });

function normalizeForMatch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
}

function scoreSpaceMatch(
  targetQuery: string,
  title: string,
  slug: string,
): number {
  const q = normalizeForMatch(targetQuery);
  const t = normalizeForMatch(title);
  const s = normalizeForMatch(slug);
  if (!q) return 0;
  if (q === s) return 200;
  if (q === t) return 180;
  let score = 0;
  if (t.includes(q)) score += 80;
  if (s.includes(q)) score += 70;
  const queryTokens = q.split(' ').filter(Boolean);
  const titleTokens = new Set(t.split(' ').filter(Boolean));
  const slugTokens = new Set(s.split(' ').filter(Boolean));
  for (const token of queryTokens) {
    if (titleTokens.has(token)) score += 14;
    if (slugTokens.has(token)) score += 12;
  }
  return score;
}

function inferScreenFromIntent(
  intentText: string | undefined,
): z.infer<typeof spaceScreenSchema> | null {
  const normalized = (intentText ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (
    /\b(signal|signals|coherence|alert|alerts|issue|issues|blind spot|priority)\b/.test(
      normalized,
    )
  ) {
    return 'signals';
  }
  if (
    /\b(treasury|token|tokens|vault|fund|funds|payment|payments|payout|payouts|finance)\b/.test(
      normalized,
    )
  ) {
    return 'treasury';
  }
  if (
    /\b(member|members|people|team|teams|contributor|contributors)\b/.test(
      normalized,
    )
  ) {
    return 'members';
  }
  if (/\b(reward|rewards|incentive|incentives)\b/.test(normalized)) {
    return 'rewards';
  }
  if (/\b(memory|knowledge|transcript|recording|notes)\b/.test(normalized)) {
    return 'memory';
  }
  if (/\b(config|configuration|settings|set up|setup)\b/.test(normalized)) {
    return 'space_configuration';
  }
  if (
    /\b(proposal|proposals|agreement|agreements|vote|voting|governance|document|documents)\b/.test(
      normalized,
    )
  ) {
    return 'agreements';
  }
  if (/\b(ecosystem|network|subspace|subspaces)\b/.test(normalized)) {
    return 'ecosystem_navigation';
  }
  if (/\b(overview|home|summary|dashboard)\b/.test(normalized)) {
    return 'overview';
  }
  return null;
}

function resolveSpaceScreenPath(
  lang: string,
  spaceSlug: string,
  screen: z.infer<typeof spaceScreenSchema>,
): string {
  if (screen === 'overview') return `/${lang}/dho/${spaceSlug}/overview`;
  if (screen === 'ecosystem_navigation')
    return `/${lang}/dho/${spaceSlug}/ecosystem-navigation`;
  if (screen === 'signals') return `/${lang}/dho/${spaceSlug}/coherence`;
  if (screen === 'agreements') return `/${lang}/dho/${spaceSlug}/agreements`;
  if (screen === 'members') return `/${lang}/dho/${spaceSlug}/members`;
  if (screen === 'treasury') return `/${lang}/dho/${spaceSlug}/treasury`;
  if (screen === 'rewards') return `/${lang}/dho/${spaceSlug}/rewards`;
  if (screen === 'memory') return `/${lang}/dho/${spaceSlug}/memory`;
  return `/${lang}/dho/${spaceSlug}/agreements/space-configuration`;
}

function resolveAppScreenPath(
  lang: string,
  screen: z.infer<typeof appScreenSchema>,
): string {
  if (screen === 'onboarding') return `/${lang}/onboarding`;
  if (screen === 'network') return `/${lang}/network`;
  if (screen === 'my_spaces') return `/${lang}/my-spaces`;
  if (screen === 'create_space') return `/${lang}/my-spaces/create`;
  return `/${lang}/profile/signup`;
}

function shouldForceNetworkDiscoveryScreen(intentText: string): boolean {
  const normalized = intentText.trim().toLowerCase();
  if (!normalized) return false;
  if (
    /\b(onboarding|onboard|set up|setup|create space|new space|start space)\b/.test(
      normalized,
    )
  ) {
    return false;
  }
  return /\b(find|search|look up|discover|explore|join|space|spaces|hypha|network)\b/.test(
    normalized,
  );
}

export function createMcpNavigationTool(authToken: string) {
  return {
    description:
      'Navigation router for MCP flows. Resolve where to send the user next: a space, a screen inside a space, a global app screen, or an external website.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) return { ok: false, error: parsed.error.message };

      const data = parsed.data;
      const lang = data.lang?.trim() || 'en';
      const customLabel = data.label?.trim() || null;

      if (data.destination_type === 'website') {
        const href = data.website_url as string;
        return {
          ok: true,
          destination_type: 'website',
          navigation: {
            kind: 'external',
            href,
            label: customLabel ?? 'Open website',
            open_in_new_tab: data.open_in_new_tab ?? true,
          },
          message: `Open website: ${href}`,
        };
      }

      if (data.destination_type === 'app_screen') {
        const requestedScreen = data.app_screen as z.infer<typeof appScreenSchema>;
        const intentText = [data.context_hint, data.label]
          .filter((value): value is string => typeof value === 'string')
          .join(' ');
        const screen =
          requestedScreen === 'onboarding' &&
          shouldForceNetworkDiscoveryScreen(intentText)
            ? 'network'
            : requestedScreen;
        const href = resolveAppScreenPath(lang, screen);
        return {
          ok: true,
          destination_type: 'app_screen',
          navigation: {
            kind: 'internal',
            href,
            screen,
            label: customLabel ?? `Open ${screen.replace(/_/g, ' ')}`,
            open_in_new_tab: data.open_in_new_tab ?? false,
          },
          message: `Navigate to ${screen.replace(/_/g, ' ')}.`,
        };
      }

      if (data.destination_type === 'ecosystem_space') {
        const rawTargetQuery = data.target_space_query?.trim() ?? '';
        if (!rawTargetQuery) {
          return { ok: false, error: 'Missing target space query.' };
        }

        const safeSourceSlug = sanitizeSlug(data.source_space_slug ?? '');
        const sourceSpace =
          safeSourceSlug && safeSourceSlug.length > 0
            ? await findSpaceBySlug({ slug: safeSourceSlug }, { db })
            : null;
        const sourceAccessible =
          sourceSpace != null
            ? await checkSpaceAccessForSpace(sourceSpace, authToken)
            : null;
        const ecosystemSpaces =
          sourceSpace && sourceAccessible?.hasAccess
            ? (
                await getAllOrganizationSpacesForNodeById({
                  id: sourceSpace.id,
                })
              ).filter((space) => !space.flags?.includes('archived'))
            : [];

        const globalMatches = await findAllSpaces(
          { db },
          {
            search: rawTargetQuery,
            parentOnly: false,
            omitSandbox: false,
            omitArchived: true,
          },
        );

        type NavigationCandidate = {
          id: number;
          slug: string;
          title: string;
          web3SpaceId?: number | null;
          flags?: string[] | null;
          in_source_ecosystem: boolean;
        };
        const ecosystemCandidateIds = new Set(
          ecosystemSpaces
            .map((space) => space?.id)
            .filter((value): value is number => typeof value === 'number'),
        );
        const uniqueCandidates = new Map<number, NavigationCandidate>();
        for (const space of ecosystemSpaces) {
          if (!space?.id || typeof space.slug !== 'string') continue;
          uniqueCandidates.set(space.id, {
            id: space.id,
            slug: space.slug,
            title: space.title,
            web3SpaceId:
              typeof space.web3SpaceId === 'number' ? space.web3SpaceId : null,
            flags: Array.isArray(space.flags)
              ? space.flags.map((flag) => String(flag))
              : null,
            in_source_ecosystem: true,
          });
        }
        for (const space of globalMatches) {
          if (!space?.id || typeof space.slug !== 'string') continue;
          if (uniqueCandidates.has(space.id)) continue;
          uniqueCandidates.set(space.id, {
            id: space.id,
            slug: space.slug,
            title: space.title,
            web3SpaceId:
              typeof space.web3SpaceId === 'number' ? space.web3SpaceId : null,
            flags: Array.isArray(space.flags)
              ? space.flags.map((flag) => String(flag))
              : null,
            in_source_ecosystem: ecosystemCandidateIds.has(space.id),
          });
        }

        const ranked = [...uniqueCandidates.values()]
          .map((space) => ({
            space,
            score:
              scoreSpaceMatch(rawTargetQuery, space.title, space.slug) +
              (space.in_source_ecosystem ? 50 : 0),
          }))
          .filter((row) => row.score > 0)
          .sort(
            (a, b) =>
              b.score - a.score || a.space.title.localeCompare(b.space.title),
          );

        if (ranked.length === 0) {
          return {
            ok: false,
            error:
              'No matching space was found. Ask the user for the exact space name.',
          };
        }

        const rankedEcosystemFirst = ranked.filter(
          (row) => row.space.in_source_ecosystem,
        );
        const rankedGlobalFallback = ranked.filter(
          (row) => !row.space.in_source_ecosystem,
        );
        const rankedCandidates = [
          ...rankedEcosystemFirst,
          ...rankedGlobalFallback,
        ];

        let destinationSpace: (typeof rankedCandidates)[number]['space'] | null =
          null;
        let resolvedScope: 'ecosystem' | 'network' | null = null;
        for (const row of rankedCandidates) {
          const access = await checkSpaceAccessForSpace(row.space, authToken);
          if (access.hasAccess) {
            destinationSpace = row.space;
            resolvedScope = row.space.in_source_ecosystem
              ? 'ecosystem'
              : 'network';
            break;
          }
        }
        if (!destinationSpace) {
          return {
            ok: false,
            error: 'No accessible matching space was found for this user.',
          };
        }

        const inferredScreen = inferScreenFromIntent(
          [data.context_hint, rawTargetQuery, data.label]
            .filter(Boolean)
            .join(' '),
        );
        const screen = data.space_screen ?? inferredScreen;
        const href = screen
          ? resolveSpaceScreenPath(lang, destinationSpace.slug, screen)
          : `/${lang}/dho/${destinationSpace.slug}/agreements`;

        return {
          ok: true,
          destination_type: 'ecosystem_space',
          source_space_slug: safeSourceSlug || null,
          resolution_scope: resolvedScope,
          navigation: {
            kind: 'internal',
            href,
            space_slug: destinationSpace.slug,
            screen: screen ?? 'agreements',
            label:
              customLabel ??
              `Open ${destinationSpace.title}${
                screen ? ` (${screen.replace(/_/g, ' ')})` : ''
              }`,
            open_in_new_tab: data.open_in_new_tab ?? false,
          },
          matched_space: {
            slug: destinationSpace.slug,
            title: destinationSpace.title,
          },
          alternatives: ranked.slice(1, 4).map((row) => ({
            slug: row.space.slug,
            title: row.space.title,
          })),
          message: `Navigate to "${destinationSpace.title}".`,
        };
      }

      const safeSlug = sanitizeSlug(data.space_slug ?? '');
      if (!safeSlug) {
        return { ok: false, error: 'Invalid or missing space_slug.' };
      }

      const host = await findSpaceBySlug({ slug: safeSlug }, { db });
      if (!host) {
        return { ok: false, error: `Space "${safeSlug}" was not found.` };
      }
      const access = await checkSpaceAccessForSpace(host, authToken);
      if (!access.hasAccess) {
        return { ok: false, error: access.message };
      }

      if (data.destination_type === 'space') {
        const inferredScreen = inferScreenFromIntent(
          [data.context_hint, data.label].filter(Boolean).join(' '),
        );
        const targetScreen = data.space_screen ?? inferredScreen;
        const href = targetScreen
          ? resolveSpaceScreenPath(lang, safeSlug, targetScreen)
          : `/${lang}/dho/${safeSlug}/agreements`;
        return {
          ok: true,
          destination_type: 'space',
          navigation: {
            kind: 'internal',
            href,
            space_slug: safeSlug,
            ...(targetScreen ? { screen: targetScreen } : {}),
            label: customLabel ?? `Open ${host.title}`,
            open_in_new_tab: data.open_in_new_tab ?? false,
          },
          message: `Navigate to space "${host.title}".`,
        };
      }

      const screen = data.space_screen as z.infer<typeof spaceScreenSchema>;
      const href = resolveSpaceScreenPath(lang, safeSlug, screen);
      return {
        ok: true,
        destination_type: 'space_screen',
        navigation: {
          kind: 'internal',
          href,
          space_slug: safeSlug,
          screen,
          label: customLabel ?? `Open ${screen.replace(/_/g, ' ')}`,
          open_in_new_tab: data.open_in_new_tab ?? false,
        },
        message: `Navigate to ${screen.replace(/_/g, ' ')} in "${host.title}".`,
      };
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
