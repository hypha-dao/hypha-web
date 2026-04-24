import type { BrowserContext } from '@playwright/test';

/** Must match `packages/cookie` → `HYPHA_ENABLE_AI_CHAT` */
const HYPHA_ENABLE_AI_CHAT = 'HYPHA_ENABLE_AI_CHAT' as const;

const cookie = {
  name: HYPHA_ENABLE_AI_CHAT,
  value: 'true',
  domain: '127.0.0.1',
  path: '/',
} as const;

export const extraHttpHeadersEnableAiChat = {
  Cookie: `${HYPHA_ENABLE_AI_CHAT}=true`,
} as const;

export async function addEnableAiChatCookie(context: BrowserContext) {
  await context.addCookies([cookie]);
}
