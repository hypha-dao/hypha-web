import { z } from 'zod';
import {
  checkSpaceAccessForSpace,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';

const destinationTypeSchema = z.enum([
  'space',
  'space_screen',
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
        const screen = data.app_screen as z.infer<typeof appScreenSchema>;
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
        const href = `/${lang}/dho/${safeSlug}/agreements`;
        return {
          ok: true,
          destination_type: 'space',
          navigation: {
            kind: 'internal',
            href,
            space_slug: safeSlug,
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
