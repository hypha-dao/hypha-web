import { cookies } from 'next/headers';
import {
  HYPHA_AUTH_PROVIDER,
  HYPHA_ENABLE_AI_CHAT,
  HYPHA_ENABLE_COHERENCE,
  HYPHA_ENABLE_HUMAN_CHAT,
  HYPHA_SHOW_LANGUAGE_SELECT,
} from '@hypha-platform/cookie';
import {
  getVercelToolbarFlagOverrides,
  readBooleanOverride,
} from './vercel-toolbar-overrides';

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
    defaultValue: false,
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
      'Enable Coherence signals, threads, and conversation features in space pages',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
  enableHumanChat: {
    key: 'enable-human-chat',
    defaultValue: false,
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
  return store.get(HYPHA_AUTH_PROVIDER)?.value === 'web3auth';
}

export async function getShowLanguageSelect(): Promise<boolean> {
  const overrides = await getVercelToolbarFlagOverrides();
  const o = readBooleanOverride(overrides, 'show-language-select');
  if (o !== undefined) return o;

  const store = await cookies();
  return store.get(HYPHA_SHOW_LANGUAGE_SELECT)?.value === 'true';
}

export async function getEnableAiChat(): Promise<boolean> {
  const overrides = await getVercelToolbarFlagOverrides();
  const o = readBooleanOverride(overrides, 'enable-ai-chat');
  if (o !== undefined) return o;

  const store = await cookies();
  const cookieValue = store.get(HYPHA_ENABLE_AI_CHAT)?.value;
  if (cookieValue !== undefined) return cookieValue === 'true';
  return process.env.NEXT_PUBLIC_ENABLE_AI_CHAT === 'true';
}

export async function getEnableCoherence(): Promise<boolean> {
  const overrides = await getVercelToolbarFlagOverrides();
  const o = readBooleanOverride(overrides, 'enable-coherence');
  if (o !== undefined) return o;

  const store = await cookies();
  const cookieValue = store.get(HYPHA_ENABLE_COHERENCE)?.value;
  if (cookieValue !== undefined) return cookieValue === 'true';
  return process.env.NEXT_PUBLIC_ENABLE_COHERENCE === 'true';
}

export async function getEnableHumanChat(): Promise<boolean> {
  const overrides = await getVercelToolbarFlagOverrides();
  const o = readBooleanOverride(overrides, 'enable-human-chat');
  if (o !== undefined) return o;

  const store = await cookies();
  const cookieValue = store.get(HYPHA_ENABLE_HUMAN_CHAT)?.value;
  if (cookieValue !== undefined) return cookieValue === 'true';
  return process.env.NEXT_PUBLIC_ENABLE_HUMAN_CHAT === 'true';
}
