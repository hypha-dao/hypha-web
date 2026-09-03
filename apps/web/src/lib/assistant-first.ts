import 'server-only';
import { cookies } from 'next/headers';

import { getEnableAssistantAsync } from '@hypha-platform/feature-flags';
import { HYPHA_ASSISTANT_MODE } from '@hypha-platform/cookie';

/**
 * #2486: `true` when the talk-first assistant should be the default landing
 * experience — the `enable-assistant` flag is on **and** the viewer has not
 * opted into the classic app (`HYPHA_ASSISTANT_MODE=classic` cookie).
 *
 * Server-only (reads `cookies()`). Used by the entry points that would
 * otherwise render the classic app: `/[lang]`, `/[lang]/my-spaces`, and the
 * post-auth `baseRedirectPath` in the root layout.
 */
export async function resolveAssistantFirst(): Promise<boolean> {
  try {
    const [enabled, store] = await Promise.all([
      getEnableAssistantAsync(),
      cookies(),
    ]);
    return enabled && store.get(HYPHA_ASSISTANT_MODE)?.value !== 'classic';
  } catch (reason) {
    console.error('[assistant-first] resolve failed', reason);
    return false;
  }
}
