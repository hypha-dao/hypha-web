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
 * **Guideline:** product feature flags (AI / Human / Coherence / Space Memory) default **off**
 * until enabled via cookie, `NEXT_PUBLIC_*=true`, or Vercel Flags Toolbar. Human chat kill
 * switch: `HYPHA_DISABLE_HUMAN_CHAT=true` / `NEXT_PUBLIC_DISABLE_HUMAN_CHAT=true`.
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
    description:
      'Web3 auth — enabled only when HYPHA_AUTH_PROVIDER=web3auth (cookie) or toolbar override; not a global product default',
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
    description:
      'AI Chat panel on space pages. Opt in: cookie or NEXT_PUBLIC_ENABLE_AI_CHAT=true',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
  enableCoherence: {
    key: 'enable-coherence',
    defaultValue: false,
    description:
      'Coherence tab and signals. Opt in: HYPHA_ENABLE_COHERENCE cookie or NEXT_PUBLIC_ENABLE_COHERENCE=true. Space Memory uses enable-space-memory.',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
  enableSpaceMemory: {
    key: 'enable-space-memory',
    defaultValue: false,
    description:
      'Space Memory on Coherence tab. Opt in: HYPHA_ENABLE_SPACE_MEMORY cookie or NEXT_PUBLIC_ENABLE_SPACE_MEMORY=true',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
  /**
   * Toolbar key matches `readBooleanOverride(..., 'enable-human-chat')`.
   */
  enableHumanChat: {
    key: 'enable-human-chat',
    defaultValue: false,
    description:
      'Human Chat panel. Opt in: HYPHA_ENABLE_HUMAN_CHAT cookie or NEXT_PUBLIC_ENABLE_HUMAN_CHAT=true. Kill-switch: HYPHA_DISABLE_HUMAN_CHAT cookie or NEXT_PUBLIC_DISABLE_HUMAN_CHAT=true',
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
  if (cookieValue === 'true') return true;
  if (cookieValue === 'false') return false;
  if (envValue === 'true') return true;
  if (envValue === 'false') return false;
  return false;
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
 * Opt-in via `NEXT_PUBLIC_ENABLE_HUMAN_CHAT`, cookie, or toolbar. Kill switch still wins.
 */
export async function getEnableHumanChat(): Promise<boolean> {
  const overrides = await getVercelToolbarFlagOverrides();
  const toolbarHumanChat = readBooleanOverride(overrides, 'enable-human-chat');
  if (toolbarHumanChat !== undefined) return toolbarHumanChat;

  const store = await cookies();

  if (store.get(HYPHA_DISABLE_HUMAN_CHAT)?.value === 'true') {
    return false;
  }

  if (process.env.NEXT_PUBLIC_DISABLE_HUMAN_CHAT === 'true') return false;

  const legacyEnable = store.get(HYPHA_ENABLE_HUMAN_CHAT)?.value;
  if (legacyEnable === 'true') return true;
  if (legacyEnable === 'false') return false;

  return process.env.NEXT_PUBLIC_ENABLE_HUMAN_CHAT === 'true';
}

export async function getEnableSpaceMemory(): Promise<boolean> {
  return getBooleanFlagFromToolbarCookieOrEnv(
    'enable-space-memory',
    HYPHA_ENABLE_SPACE_MEMORY,
    process.env.NEXT_PUBLIC_ENABLE_SPACE_MEMORY,
  );
}
