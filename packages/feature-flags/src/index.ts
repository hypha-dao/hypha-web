import { flag } from 'flags/next';
import {
  HYPHA_AUTH_PROVIDER,
  HYPHA_ENABLE_AI_CHAT,
  HYPHA_ENABLE_COHERENCE,
  HYPHA_ENABLE_HUMAN_CHAT,
  HYPHA_SHOW_LANGUAGE_SELECT,
} from '@hypha-platform/cookie';

export const enableWeb3Auth = flag<boolean>({
  key: 'enable-web3-auth',
  decide({ cookies }) {
    return cookies.get(HYPHA_AUTH_PROVIDER)?.value === 'web3auth';
  },
});

export const showLanguageSelect = flag<boolean>({
  key: 'show-language-select',
  defaultValue: false,
  description: 'Show the i18n language select button in the menu bar',
  decide({ cookies }) {
    return cookies.get(HYPHA_SHOW_LANGUAGE_SELECT)?.value === 'true';
  },
});

export const enableAiChat = flag<boolean>({
  key: 'enable-ai-chat',
  defaultValue: false,
  description: 'Enable the AI Chat panel in space pages',
  decide({ cookies }) {
    // Cookie override takes precedence, then fall back to env var
    const cookieValue = cookies.get(HYPHA_ENABLE_AI_CHAT)?.value;
    if (cookieValue !== undefined) return cookieValue === 'true';
    return process.env.NEXT_PUBLIC_ENABLE_AI_CHAT === 'true';
  },
});

export const enableCoherence = flag<boolean>({
  key: 'enable-coherence',
  defaultValue: false,
  description:
    'Enable Coherence signals, threads, and conversation features in space pages',
  decide({ cookies }) {
    const cookieValue = cookies.get(HYPHA_ENABLE_COHERENCE)?.value;
    if (cookieValue !== undefined) return cookieValue === 'true';
    return process.env.NEXT_PUBLIC_ENABLE_COHERENCE === 'true';
  },
});

export const enableHumanChat = flag<boolean>({
  key: 'enable-human-chat',
  defaultValue: false,
  description: 'Enable the Human Chat panel in space pages',
  decide({ cookies }) {
    const cookieValue = cookies.get(HYPHA_ENABLE_HUMAN_CHAT)?.value;
    if (cookieValue !== undefined) return cookieValue === 'true';
    return process.env.NEXT_PUBLIC_ENABLE_HUMAN_CHAT === 'true';
  },
});
