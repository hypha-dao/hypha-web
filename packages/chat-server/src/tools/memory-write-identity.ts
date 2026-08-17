import {
  resolveCanonicalSourceApp,
  type ResolveCanonicalSourceAppResult,
} from '@hypha-platform/core/intelligence';

export const HYPHA_AI_SOURCE_APP_FALLBACK = 'hypha-ai';

/** Server-assigned source_app for Hypha AI intelligence writes. */
export function resolveHyphaAiSourceApp(
  claimed?: string,
): ResolveCanonicalSourceAppResult {
  return resolveCanonicalSourceApp({
    claimed,
    configured: process.env.HYPHA_AI_SOURCE_APP?.trim() || undefined,
    fallback: HYPHA_AI_SOURCE_APP_FALLBACK,
  });
}
