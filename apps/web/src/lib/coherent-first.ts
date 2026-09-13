import 'server-only';
import { cookies } from 'next/headers';

import { getEnableCoherentIntelligentSystemAsync } from '@hypha-platform/feature-flags';
import { HYPHA_COHERENT_MODE } from '@hypha-platform/cookie';

/**
 * #2486: `true` when the talk-first Coherent entrypoint should be the default
 * landing experience — the `enable-coherent-intelligent-system` flag is on
 * **and** the viewer has not opted into the classic app
 * (`HYPHA_COHERENT_MODE=classic` cookie).
 *
 * Server-only (reads `cookies()`). Used by the entry points that would
 * otherwise render the classic app: `/[lang]`, `/[lang]/my-spaces`, and the
 * post-auth `baseRedirectPath` in the root layout.
 */
export async function resolveCoherentFirst(): Promise<boolean> {
  try {
    const [enabled, store] = await Promise.all([
      getEnableCoherentIntelligentSystemAsync(),
      cookies(),
    ]);
    return enabled && store.get(HYPHA_COHERENT_MODE)?.value !== 'classic';
  } catch (reason) {
    console.error('[coherent-first] resolve failed', reason);
    return false;
  }
}
