import {
  getEnableCoherence,
  getEnableSpaceMemory,
} from '@hypha-platform/feature-flags';
import type { Locale } from '@hypha-platform/i18n';
import { getDhoPathAgreements } from '../agreements/constants';
import { getDhoPathCoherence } from '../coherence/constants';

/**
 * When Wiki is disabled, single source of truth for which tab to open instead
 * (matches coherence page redirect semantics).
 */
export async function getRedirectWhenWikiDisabled(
  lang: Locale,
  id: string,
): Promise<string | null> {
  const [spaceMemoryEnabled, coherenceEnabled] = await Promise.all([
    getEnableSpaceMemory(),
    getEnableCoherence(),
  ]);
  if (spaceMemoryEnabled) return null;
  return coherenceEnabled
    ? getDhoPathCoherence(lang, id)
    : getDhoPathAgreements(lang, id);
}
