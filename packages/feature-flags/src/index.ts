import { cookies } from 'next/headers';
import {
  HYPHA_AUTH_PROVIDER,
  HYPHA_ENABLE_AI_CHAT,
  HYPHA_ENABLE_COHERENCE,
  HYPHA_ENABLE_HUMAN_CHAT,
  HYPHA_SHOW_LANGUAGE_SELECT,
} from '@hypha-platform/cookie';

/**
 * Static metadata for Vercel Flags discovery (`/.well-known/vercel/flags`).
 * Runtime reads use the `get*` functions below (cookies + env), not `flags/next`,
 * so SSR works without `FLAGS_SECRET` (which `flags@4` requires for serialization).
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
  const store = await cookies();
  return store.get(HYPHA_AUTH_PROVIDER)?.value === 'web3auth';
}

export async function getShowLanguageSelect(): Promise<boolean> {
  const store = await cookies();
  return store.get(HYPHA_SHOW_LANGUAGE_SELECT)?.value === 'true';
}

export async function getEnableAiChat(): Promise<boolean> {
  const store = await cookies();
  const cookieValue = store.get(HYPHA_ENABLE_AI_CHAT)?.value;
  if (cookieValue !== undefined) return cookieValue === 'true';
  return process.env.NEXT_PUBLIC_ENABLE_AI_CHAT === 'true';
}

export async function getEnableCoherence(): Promise<boolean> {
  const store = await cookies();
  const cookieValue = store.get(HYPHA_ENABLE_COHERENCE)?.value;
  if (cookieValue !== undefined) return cookieValue === 'true';
  return process.env.NEXT_PUBLIC_ENABLE_COHERENCE === 'true';
}

export async function getEnableHumanChat(): Promise<boolean> {
  const store = await cookies();
  const cookieValue = store.get(HYPHA_ENABLE_HUMAN_CHAT)?.value;
  if (cookieValue !== undefined) return cookieValue === 'true';
  return process.env.NEXT_PUBLIC_ENABLE_HUMAN_CHAT === 'true';
}
