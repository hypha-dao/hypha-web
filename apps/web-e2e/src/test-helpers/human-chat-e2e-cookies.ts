import type { BrowserContext } from '@playwright/test';

/** Opt-in for SSR + browser: Human Chat (right panel) defaults off in app; tests enable explicitly. */
export const HYPHA_ENABLE_HUMAN_CHAT = 'HYPHA_ENABLE_HUMAN_CHAT' as const;

const humanChatCookie = {
  name: HYPHA_ENABLE_HUMAN_CHAT,
  value: 'true',
  domain: '127.0.0.1',
  path: '/',
} as const;

export const extraHttpHeadersEnableHumanChat = {
  Cookie: `${HYPHA_ENABLE_HUMAN_CHAT}=true`,
} as const;

export async function addEnableHumanChatCookie(context: BrowserContext) {
  await context.addCookies([humanChatCookie]);
}
