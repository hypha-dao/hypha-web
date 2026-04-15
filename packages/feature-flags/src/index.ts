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

const isPreviewEnvironment = () => process.env.VERCEL_ENV === 'preview';

/**
 * **Guideline:** AI / Coherence / Space Memory / Human Chat default **off** until
 * enabled via cookie, `NEXT_PUBLIC_*=true`, or Vercel Flags Toolbar. Human Chat
 * opt-in: `getEnableHumanChat`. Kill switch: `HYPHA_DISABLE_HUMAN_CHAT=true` /
 * `NEXT_PUBLIC_DISABLE_HUMAN_CHAT=true` (wins over enable).
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
    defaultValue: isPreviewEnvironment(),
    description: 'Use Web3Auth as the auth provider when cookie matches',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
  showLanguageSelect: {
    key: 'show-language-select',
    defaultValue: isPreviewEnvironment(),
    description: 'Show the i18n language select button in the menu bar',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
  enableAiChat: {
    key: 'enable-ai-chat',
    defaultValue: isPreviewEnvironment(),
    description: 'Enable the AI Chat panel in space pages',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
  enableCoherence: {
    key: 'enable-coherence',
    defaultValue: isPreviewEnvironment(),
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
   * Discovery `defaultValue` matches {@link getEnableHumanChat} when unset (opt-in).
   */
  enableHumanChat: {
    key: 'enable-human-chat',
    defaultValue: isPreviewEnvironment(),
    description: 'Enable the Human Chat panel in space pages',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
};

export async function getEnableWeb3Auth(): Promise<boolean> {
  const overrides = await getVercelToolbarFlagOverrides();
  const o = readBooleanOverride(overrides, 'enable-web3-auth');
  if (o !== undefined) return o;

  const store = await cookies();
  const provider = store.get(HYPHA_AUTH_PROVIDER)?.value;
  if (provider === 'web3auth') return true;
  if (provider !== undefined) return false;
  return isPreviewEnvironment();
}

export async function getShowLanguageSelect(): Promise<boolean> {
  const overrides = await getVercelToolbarFlagOverrides();
  const o = readBooleanOverride(overrides, 'show-language-select');
  if (o !== undefined) return o;

  const store = await cookies();
  const v = store.get(HYPHA_SHOW_LANGUAGE_SELECT)?.value;
  if (v !== undefined) return v === 'true';
  return isPreviewEnvironment();
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
  if (envValue === 'true') return true;
  return isPreviewEnvironment();
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
 * Human Chat right panel: **off** by default. Opt in via cookie, `NEXT_PUBLIC_ENABLE_HUMAN_CHAT`,
 * or Vercel toolbar. Kill switch (`HYPHA_DISABLE_HUMAN_CHAT` / `NEXT_PUBLIC_DISABLE_HUMAN_CHAT`) wins.
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

  if (process.env.NEXT_PUBLIC_ENABLE_HUMAN_CHAT === 'true') return true;
  if (process.env.NEXT_PUBLIC_ENABLE_HUMAN_CHAT === 'false') return false;

  return false;
}

export async function getEnableSpaceMemory(): Promise<boolean> {
  return getBooleanFlagFromToolbarCookieOrEnv(
    'enable-space-memory',
    HYPHA_ENABLE_SPACE_MEMORY,
    process.env.NEXT_PUBLIC_ENABLE_SPACE_MEMORY,
  );
}
