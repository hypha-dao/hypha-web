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
import {
  getVercelToolbarFlagOverrides,
  readBooleanOverride,
} from './vercel-toolbar-overrides';

/**
 * **Guideline (most flags):** safe defaults, features off until enabled via cookie/env/toolbar.
 *
 * **Exception — Human Chat:** {@link getEnableHumanChat} is intentionally **default on** with
 * a documented kill switch (`HYPHA_DISABLE_HUMAN_CHAT`, env, toolbar). Product and ops
 * rollback: set `HYPHA_DISABLE_HUMAN_CHAT=true` or `NEXT_PUBLIC_DISABLE_HUMAN_CHAT=true`.
 */

/**
 * Static metadata for Vercel Flags discovery (`/.well-known/vercel/flags`).
 * Runtime reads use the `get*` functions below.
 *
 * **Vercel Toolbar:** When `FLAGS_SECRET` is set, `get*` reads the
 * `vercel-flag-overrides` cookie (same as `flags/next`) so toolbar toggles apply.
 * Hypha cookies / `NEXT_PUBLIC_*` are used when there is no override for that key.
 * Without `FLAGS_SECRET`, SSR still works; toolbar overrides are ignored until the
 * secret is configured on the project.
 */
export const flagDefinitionsForDiscovery = {
  enableWeb3Auth: {
    key: 'enable-web3-auth',
    defaultValue: false,
    description: 'Use Web3Auth as the auth provider when cookie matches',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
  showLanguageSelect: {
    key: 'show-language-select',
    defaultValue: true,
    description: 'Show the i18n language select button in the menu bar',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
  enableAiChat: {
    key: 'enable-ai-chat',
    defaultValue: false,
    description: 'Enable the AI Chat panel in space pages',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
  enableCoherence: {
    key: 'enable-coherence',
    defaultValue: false,
    description:
      'Legacy flag kept for tooling/discovery; Coherence tab and signals are always available. Space Memory uses enable-space-memory.',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
  enableSpaceMemory: {
    key: 'enable-space-memory',
    defaultValue: false,
    description: 'Show the Space Memory panel on the Coherence tab',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
  /**
   * Toolbar key matches `readBooleanOverride(..., 'enable-human-chat')`.
   * Runtime default is on (kill-switch opt-out); discovery metadata reflects that.
   */
  enableHumanChat: {
    key: 'enable-human-chat',
    defaultValue: true,
    description:
      'Human Chat panel (default on; disable via HYPHA_DISABLE_HUMAN_CHAT / toolbar)',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
};

export async function getEnableWeb3Auth(): Promise<boolean> {
  const overrides = await getVercelToolbarFlagOverrides();
  const o = readBooleanOverride(overrides, 'enable-web3-auth');
  if (o !== undefined) return o;

  const store = await cookies();
  return store.get(HYPHA_AUTH_PROVIDER)?.value === 'web3auth';
}

export async function getShowLanguageSelect(): Promise<boolean> {
  const overrides = await getVercelToolbarFlagOverrides();
  const o = readBooleanOverride(overrides, 'show-language-select');
  if (o !== undefined) return o;

  const store = await cookies();
  const cookieValue = store.get(HYPHA_SHOW_LANGUAGE_SELECT)?.value;
  if (cookieValue === 'false') return false;
  return true;
}

async function getBooleanFlagFromToolbarCookieOrEnv(
  toolbarKey: string,
  cookieName: string,
  envValue: string | undefined,
): Promise<boolean> {
  const overrides = await getVercelToolbarFlagOverrides();
  const o = readBooleanOverride(overrides, toolbarKey);
  if (o !== undefined) return o;

  const store = await cookies();
  const cookieValue = store.get(cookieName)?.value;
  if (cookieValue !== undefined) return cookieValue === 'true';
  return envValue === 'true';
}

export async function getEnableAiChat(): Promise<boolean> {
  return getBooleanFlagFromToolbarCookieOrEnv(
    'enable-ai-chat',
    HYPHA_ENABLE_AI_CHAT,
    process.env.NEXT_PUBLIC_ENABLE_AI_CHAT,
  );
}

export async function getEnableCoherence(): Promise<boolean> {
  return getBooleanFlagFromToolbarCookieOrEnv(
    'enable-coherence',
    HYPHA_ENABLE_COHERENCE,
    process.env.NEXT_PUBLIC_ENABLE_COHERENCE,
  );
}

/**
 * Human Chat is **on by default** (including production). This is an intentional
 * **opt-out** product default, not the typical `feature-flags` “off by default”
 * pattern: disable with the kill switch / env / cookies below.
 *
 * **Code review / guideline note:** Some repos prefer “features default off”; Human Chat is an
 * acknowledged exception — see module comment above. Do not flip this to `return false` without a
 * product decision (that would hide chat for all users with no opt-in path).
 *
 * Rollback:
 * - Cookie `HYPHA_DISABLE_HUMAN_CHAT=true`
 * - Or legacy opt-out: `HYPHA_ENABLE_HUMAN_CHAT=false`
 * - Or env: `NEXT_PUBLIC_DISABLE_HUMAN_CHAT=true` / `NEXT_PUBLIC_ENABLE_HUMAN_CHAT=false`
 * - Or Vercel Flags Toolbar override `enable-human-chat` → `false` (when FLAGS_SECRET is set)
 */
export async function getEnableHumanChat(): Promise<boolean> {
  const overrides = await getVercelToolbarFlagOverrides();
  const toolbarHumanChat = readBooleanOverride(overrides, 'enable-human-chat');
  if (toolbarHumanChat !== undefined) return toolbarHumanChat;

  const store = await cookies();

  if (store.get(HYPHA_DISABLE_HUMAN_CHAT)?.value === 'true') {
    return false;
  }

  const legacyEnable = store.get(HYPHA_ENABLE_HUMAN_CHAT)?.value;
  if (legacyEnable === 'false') return false;

  if (process.env.NEXT_PUBLIC_DISABLE_HUMAN_CHAT === 'true') return false;
  if (process.env.NEXT_PUBLIC_ENABLE_HUMAN_CHAT === 'false') return false;

  return true;
}

export async function getEnableSpaceMemory(): Promise<boolean> {
  return getBooleanFlagFromToolbarCookieOrEnv(
    'enable-space-memory',
    HYPHA_ENABLE_SPACE_MEMORY,
    process.env.NEXT_PUBLIC_ENABLE_SPACE_MEMORY,
  );
}
