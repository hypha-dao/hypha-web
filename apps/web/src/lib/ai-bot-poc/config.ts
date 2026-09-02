// server-only: reached only from API route handlers (#2485 POC).

/**
 * #2485 — AI-bot-in-Matrix POC. Environment resolution, isolated so teardown is one folder.
 *
 * Reused from #2428 / #2483 (unchanged): `HYPHA_MATRIX_BOT_AS_TOKEN`,
 * `NEXT_PUBLIC_MATRIX_HOMESERVER_URL`.
 * New, POC-only: `HYPHA_CONTEXT_REPO_PATH`, `AI_BOT_POC_HOMESERVER`, `AI_BOT_POC_MODEL`,
 * `AI_BOT_POC_AS_TOKEN` (optional override if a separate AS registration is used).
 */

export interface AiBotPocConfig {
  /** AS token used to puppet the `@hyphabot_*` personas. */
  asToken: string;
  /** Homeserver base URL for client-server API calls, e.g. `http://localhost:8008`. */
  homeserverUrl: string;
  /** Server name for building `@hyphabot_<persona>:<serverName>` MXIDs, e.g. `matrix.test`. */
  serverName: string;
  /** Absolute path to the local `hypha-context` checkout (knowledge source). */
  contextRepoPath: string;
  /** Optional model id override (OpenRouter form, e.g. `openai/gpt-4o-mini`). */
  modelOverride: string | null;
}

export class AiBotPocConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiBotPocConfigError';
  }
}

let cached: AiBotPocConfig | null | undefined;

/** Returns the config, or `null` (with a one-time warn) when the POC is not fully wired. */
export function getAiBotPocConfig(): AiBotPocConfig | null {
  if (cached !== undefined) return cached;

  const asToken =
    process.env.AI_BOT_POC_AS_TOKEN?.trim() ||
    process.env.HYPHA_MATRIX_BOT_AS_TOKEN?.trim() ||
    '';
  const homeserverUrl = (process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL ?? '')
    .trim()
    .replace(/\/+$/, '');
  const serverName =
    process.env.AI_BOT_POC_HOMESERVER?.trim() ||
    deriveServerName(process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID);
  const contextRepoPath = process.env.HYPHA_CONTEXT_REPO_PATH?.trim() || '';

  const missing: string[] = [];
  if (!asToken)
    missing.push('HYPHA_MATRIX_BOT_AS_TOKEN (or AI_BOT_POC_AS_TOKEN)');
  if (!homeserverUrl) missing.push('NEXT_PUBLIC_MATRIX_HOMESERVER_URL');
  if (!serverName) missing.push('AI_BOT_POC_HOMESERVER');
  if (!contextRepoPath) missing.push('HYPHA_CONTEXT_REPO_PATH');

  if (missing.length > 0) {
    console.warn(
      `[ai-bot-poc] disabled — missing env: ${missing.join(', ')}. ` +
        'Set these to enable the #2485 POC; the #2483 dispatch stub is unaffected.',
    );
    cached = null;
    return cached;
  }

  cached = {
    asToken,
    homeserverUrl,
    serverName,
    contextRepoPath,
    modelOverride: process.env.AI_BOT_POC_MODEL?.trim() || null,
  };
  console.info('[ai-bot-poc] config loaded', {
    homeserverUrl,
    serverName,
    contextRepoPath,
    modelOverride: cached.modelOverride ?? '(default openai/gpt-4o-mini)',
    asTokenSet: Boolean(asToken),
    openRouterKeySet: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
  });
  return cached;
}

function deriveServerName(botUserId: string | undefined): string {
  const raw = botUserId?.trim();
  if (!raw) return '';
  const idx = raw.indexOf(':');
  return idx > 0 ? raw.slice(idx + 1) : '';
}
