import { cookies } from 'next/headers';
import {
  HYPHA_AUTH_PROVIDER,
  HYPHA_DISABLE_HUMAN_CHAT,
  HYPHA_ENABLE_AI_CHAT,
  HYPHA_ENABLE_COHERENCE,
  HYPHA_ENABLE_HUMAN_CHAT,
  HYPHA_ENABLE_SPACE_MEMORY,
  HYPHA_SHOW_LANGUAGE_SELECT,
} from '@hypha-platform/cookie';

/**
 * Product feature toggles for SSR. Resolution order: **Hypha cookies** (explicit opt-in / opt-out),
 * then **`NEXT_PUBLIC_*` env** (`"true"` enables, `"false"` disables; when unset, **Coherence, Space
 * Memory, and AI Chat (left) default to on; Human Chat (right) defaults to off** until opted in). Kill-switch
 * `HYPHA_DISABLE_HUMAN_CHAT` / `NEXT_PUBLIC_DISABLE_HUMAN_CHAT` still forces Human Chat off.
 *
 * Vercel Flags Toolbar / `flags` package / `vercel-flag-overrides` are not used; configure behavior
 * via env and Hypha cookies only.
 */

export async function getEnableWeb3Auth(): Promise<boolean> {
  const store = await cookies();
  return store.get(HYPHA_AUTH_PROVIDER)?.value === 'web3auth';
}

export async function getShowLanguageSelect(): Promise<boolean> {
  const store = await cookies();
  const cookieValue = store.get(HYPHA_SHOW_LANGUAGE_SELECT)?.value;
  if (cookieValue === 'false') return false;
  return true;
}

/**
 * Boolean flags default to **true** when env is unset. Cookie set to `"false"` or `"true"` still wins.
 */
async function getBooleanFlagDefaultTrue(
  cookieName: string,
  envValue: string | undefined,
): Promise<boolean> {
  const store = await cookies();
  const cookieValue = store.get(cookieName)?.value;
  if (cookieValue === 'true') return true;
  if (cookieValue === 'false') return false;
  if (envValue === 'true') return true;
  if (envValue === 'false') return false;
  return true;
}

export async function getEnableAiChat(): Promise<boolean> {
  return getBooleanFlagDefaultTrue(
    HYPHA_ENABLE_AI_CHAT,
    process.env.NEXT_PUBLIC_ENABLE_AI_CHAT,
  );
}

export async function getEnableCoherence(): Promise<boolean> {
  return getBooleanFlagDefaultTrue(
    HYPHA_ENABLE_COHERENCE,
    process.env.NEXT_PUBLIC_ENABLE_COHERENCE,
  );
}

/**
 * Right panel (Human / Matrix chat). Default **off** when cookie and `NEXT_PUBLIC_ENABLE_HUMAN_CHAT`
 * are both unset; set cookie `HYPHA_ENABLE_HUMAN_CHAT=true` or env to opt in.
 */
export async function getEnableHumanChat(): Promise<boolean> {
  const store = await cookies();

  if (store.get(HYPHA_DISABLE_HUMAN_CHAT)?.value === 'true') {
    return false;
  }

  if (process.env.NEXT_PUBLIC_DISABLE_HUMAN_CHAT === 'true') return false;

  const legacyEnable = store.get(HYPHA_ENABLE_HUMAN_CHAT)?.value;
  if (legacyEnable !== undefined) return legacyEnable === 'true';

  if (process.env.NEXT_PUBLIC_ENABLE_HUMAN_CHAT === 'true') return true;
  if (process.env.NEXT_PUBLIC_ENABLE_HUMAN_CHAT === 'false') return false;
  return false;
}

export async function getEnableSpaceMemory(): Promise<boolean> {
  return getBooleanFlagDefaultTrue(
    HYPHA_ENABLE_SPACE_MEMORY,
    process.env.NEXT_PUBLIC_ENABLE_SPACE_MEMORY,
  );
}
