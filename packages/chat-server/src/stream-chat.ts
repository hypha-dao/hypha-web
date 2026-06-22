import {
  APICallError,
  convertToModelMessages,
  createIdGenerator,
  stepCountIs,
  streamText,
} from 'ai';
import type {
  StreamTextTransform,
  TextStreamPart,
  ToolSet,
  UIMessage,
} from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { ChatRequestPayload } from './request-schema';
import { buildOnboardingLocaleDirective } from './onboarding-locale';
import { buildEcosystemExecutePhaseDirective } from './onboarding-ecosystem-blueprint';
import {
  buildQuestionCompetencyDirective,
  buildSystemPrompt,
  LEFT_PANEL_NAVIGATION_GUIDELINES,
  sanitizeSlug,
} from './system-prompt';
import { resolveLatestVisualGenerationIntent } from './tools/onboarding-confirmation';
import {
  createChatTools,
  createGetDocumentsBySpaceSlugTool,
  createGetEcosystemBySpaceSlugTool,
  createGetSignalsBySpaceSlugTool,
  createGetTokenHoldingsBySpaceSlugTool,
  getSpaceBySlugTool,
} from './tools/index';

export const OPENROUTER_DEBUG = process.env.OPENROUTER_DEBUG === 'true';

/** Thrown before `streamText` when deployment is missing OpenRouter credentials (matches provider default env). */
export const MISSING_OPENROUTER_KEY_MESSAGE =
  'Hypha AI is not configured: OPENROUTER_API_KEY is missing.';

const DEFAULT_OPENROUTER_CHAT_MODEL = 'openai/gpt-4o-mini';
function parseEnvNumber(
  value: string | undefined,
  fallback: number,
  min: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, parsed);
}
const OPENROUTER_REQUEST_TIMEOUT_MS = parseEnvNumber(
  process.env.OPENROUTER_REQUEST_TIMEOUT_MS,
  20_000,
  1_000,
);
const OPENROUTER_MAX_ATTEMPTS = Math.max(
  1,
  parseEnvNumber(process.env.OPENROUTER_MAX_ATTEMPTS, 2, 1),
);
const OPENROUTER_CIRCUIT_FAILURE_THRESHOLD = Math.max(
  1,
  parseEnvNumber(process.env.OPENROUTER_CIRCUIT_FAILURE_THRESHOLD, 3, 1),
);
const OPENROUTER_CIRCUIT_COOLDOWN_MS = Math.max(
  1_000,
  parseEnvNumber(process.env.OPENROUTER_CIRCUIT_COOLDOWN_MS, 30_000, 1_000),
);

let openRouterConsecutiveFailures = 0;
let openRouterCircuitOpenedAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function anySignal(
  signals: Array<AbortSignal | null | undefined>,
): AbortSignal | undefined {
  const active = signals.filter(Boolean) as AbortSignal[];
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];
  const controller = new AbortController();
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), {
      once: true,
    });
  }
  return controller.signal;
}

function isRetryableStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

function recordOpenRouterSuccess() {
  openRouterConsecutiveFailures = 0;
  openRouterCircuitOpenedAt = 0;
}

function recordOpenRouterFailure() {
  openRouterConsecutiveFailures += 1;
  if (openRouterConsecutiveFailures >= OPENROUTER_CIRCUIT_FAILURE_THRESHOLD) {
    if (openRouterCircuitOpenedAt === 0) {
      openRouterCircuitOpenedAt = Date.now();
      console.error('[chat][openrouter][circuit-opened]', {
        failures: openRouterConsecutiveFailures,
        cooldownMs: OPENROUTER_CIRCUIT_COOLDOWN_MS,
      });
    }
  }
}

function isOpenRouterCircuitOpen(): boolean {
  if (openRouterCircuitOpenedAt === 0) return false;
  const elapsed = Date.now() - openRouterCircuitOpenedAt;
  if (elapsed >= OPENROUTER_CIRCUIT_COOLDOWN_MS) {
    openRouterCircuitOpenedAt = 0;
    openRouterConsecutiveFailures = 0;
    return false;
  }
  return true;
}

function createResilientOpenRouterFetch(baseFetch: typeof fetch): typeof fetch {
  return async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => {
    if (isOpenRouterCircuitOpen()) {
      throw new Error('OpenRouter circuit open');
    }

    let attempt = 0;
    while (attempt < OPENROUTER_MAX_ATTEMPTS) {
      attempt += 1;
      const timeoutController = new AbortController();
      const timeout = setTimeout(
        () => timeoutController.abort('OpenRouter request timeout'),
        OPENROUTER_REQUEST_TIMEOUT_MS,
      );
      try {
        const response = await baseFetch(input, {
          ...(init ?? {}),
          signal: anySignal([init?.signal, timeoutController.signal]),
        });
        if (response.ok) {
          recordOpenRouterSuccess();
          return response;
        }

        if (response.status === 401 || response.status === 403) {
          recordOpenRouterFailure();
          console.error('[chat][openrouter][auth-rejected]', {
            status: response.status,
            hasKey: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
            referer: buildOpenRouterAppHeaders()['HTTP-Referer'],
            title: buildOpenRouterAppHeaders()['X-Title'],
          });
        } else if (
          isRetryableStatus(response.status) &&
          attempt >= OPENROUTER_MAX_ATTEMPTS
        ) {
          recordOpenRouterFailure();
        }

        if (
          !isRetryableStatus(response.status) ||
          attempt >= OPENROUTER_MAX_ATTEMPTS
        ) {
          return response;
        }

        await sleep(150 * attempt);
      } catch (error) {
        const message = messageFromUnknownError(error).toLowerCase();
        const retryable =
          message.includes('fetch failed') ||
          message.includes('timeout') ||
          message.includes('network') ||
          message.includes('socket') ||
          message.includes('aborted');

        if (!retryable || attempt >= OPENROUTER_MAX_ATTEMPTS) {
          recordOpenRouterFailure();
          throw error;
        }
        await sleep(150 * attempt);
      } finally {
        clearTimeout(timeout);
      }
    }

    recordOpenRouterFailure();
    throw new Error('OpenRouter request failed after retries');
  };
}

/** @see https://openrouter.ai/docs/api/reference/authorization — Referer + title are required for many keys. */
function buildOpenRouterAppHeaders(): Record<string, string> {
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL?.trim()
      ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`
      : '') ||
    'https://hypha.earth';

  const title = process.env.OPENROUTER_APP_TITLE?.trim() || 'Hypha Platform';

  return {
    'HTTP-Referer': referer,
    'X-Title': title,
  };
}

/**
 * Provider with strict OpenRouter compatibility plus required attribution headers.
 * The package default export omits Referer/title and can trigger 401 "User not found".
 */
const openrouterWithHyphaHeaders = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY?.trim() || undefined,
  compatibility: 'strict',
  headers: buildOpenRouterAppHeaders(),
  fetch: createResilientOpenRouterFetch(fetch),
});

/**
 * OpenRouter model id for Hypha chat.
 *
 * Avoid `openrouter/auto` (and env overrides that point at it): multiple stacks see
 * spurious 401 "User not found" from the auto-router even when the same API key works
 * for concrete models. Use `OPENROUTER_CHAT_MODEL` for a stable id.
 */
function resolveOpenRouterChatModelId(): string {
  const fromEnv = process.env.OPENROUTER_CHAT_MODEL?.trim();
  if (!fromEnv) return DEFAULT_OPENROUTER_CHAT_MODEL;

  const normalizedForCompare = fromEnv.toLowerCase();
  if (
    normalizedForCompare === 'openrouter/auto' ||
    normalizedForCompare.endsWith('/openrouter/auto')
  ) {
    console.warn(
      '[chat][openrouter][model-env-ignored] OPENROUTER_CHAT_MODEL is set to the auto router; using a concrete model instead.',
      { requested: fromEnv, using: DEFAULT_OPENROUTER_CHAT_MODEL },
    );
    return DEFAULT_OPENROUTER_CHAT_MODEL;
  }

  return fromEnv;
}

function messageFromUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

const OPENROUTER_AUTH_FAILURE_REPLY = [
  'Hypha AI provider is currently unavailable (OpenRouter authorization issue).',
  '',
  'I can still answer these from deterministic space data:',
  '1. Member / document / proposal / subspace counts',
  '2. Main discussions/signals',
  '3. Documents/agreements list',
  '4. Token/treasury holdings',
  '5. A recommended next signal',
  '',
  'Try asking one of the above while provider access is being restored.',
].join('\n');
const OPENROUTER_TEMP_UNAVAILABLE_REPLY =
  'Hypha AI provider is temporarily unavailable. Please retry in a few seconds.';

type DeterministicFallbackContext = {
  text: string;
  kind:
    | 'current_space'
    | 'space_overview'
    | 'documents'
    | 'ecosystem'
    | 'tokens'
    | 'discussions'
    | 'signal_recommendation'
    | 'blindspot';
};

type SpaceOverviewIntent =
  | 'full_overview'
  | 'member_count'
  | 'document_count'
  | 'subspace_count';

function getSpaceOverviewIntent(text: string): SpaceOverviewIntent | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;

  if (
    t.includes('how many members') ||
    t.includes('member count') ||
    t.includes('members does this space have')
  ) {
    return 'member_count';
  }
  if (
    t.includes('how many documents') ||
    t.includes('how many agreements') ||
    t.includes('how many proposals') ||
    t.includes('document count') ||
    t.includes('agreement count') ||
    t.includes('proposal count')
  ) {
    return 'document_count';
  }
  if (
    t.includes('how many subspaces') ||
    t.includes('subspace count') ||
    t.includes('child spaces')
  ) {
    return 'subspace_count';
  }
  if (
    t.includes('tell me about this space') ||
    t.includes('about this space') ||
    t.includes('describe this space') ||
    t.includes('space overview')
  ) {
    return 'full_overview';
  }
  return null;
}

function isDocumentsQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return (
    t.includes('what agreements') ||
    t.includes('what documents') ||
    t.includes('list agreements') ||
    t.includes('list documents') ||
    t.includes('which agreements') ||
    t.includes('which documents') ||
    t.includes('documents exist') ||
    t.includes('agreements exist')
  );
}

function isEcosystemQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return (
    t.includes('describe structure') ||
    t.includes('space structure') ||
    t.includes('ecosystem') ||
    t.includes('interconnected') ||
    t.includes('subspace') ||
    t.includes('subspaces') ||
    t.includes('parent space')
  );
}

function isTokenQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return (
    t.includes('token') || t.includes('treasury') || t.includes('holdings')
  );
}

function isDiscussionQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return (
    t.includes('main discussion') ||
    t.includes('main discussions') ||
    t.includes('what are the discussions') ||
    t.includes('key discussion') ||
    t.includes('top discussion') ||
    t.includes('signals')
  );
}

function isSignalRecommendationQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return (
    t.includes('good signal to create') ||
    t.includes('what signal should') ||
    t.includes('which signal should') ||
    t.includes('signal should i create') ||
    t.includes('what would be a good signal')
  );
}

function isCurrentSpaceQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return (
    /\b(which|what)\s+space\b/.test(t) ||
    /\bon which space\b/.test(t) ||
    /\bin which space\b/.test(t) ||
    /\bwhere am i\b/.test(t) ||
    /\bwhich space am i\b/.test(t) ||
    /\bwhat space am i\b/.test(t) ||
    (/\bcurrent space\b/.test(t) &&
      /\b(which|what|where|am i|are we)\b/.test(t))
  );
}

function isBlindspotQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return (
    t.includes('blindspot') ||
    t.includes('blind spot') ||
    t.includes('biggest gap') ||
    t.includes('main gap') ||
    t.includes('weakest area') ||
    t.includes('weak spot')
  );
}

async function buildDeterministicSpaceFallback({
  lastUserText,
  spaceSlug,
  authToken,
  debugRequestId,
}: {
  lastUserText: string | null;
  spaceSlug: string | null | undefined;
  authToken: string;
  debugRequestId: string;
}): Promise<DeterministicFallbackContext | null> {
  if (!lastUserText) return null;

  const safe = spaceSlug ? sanitizeSlug(spaceSlug) : null;
  if (!safe) return null;

  try {
    if (isCurrentSpaceQuestion(lastUserText)) {
      const spaceResult = await getSpaceBySlugTool.execute({ slug: safe });
      if (
        spaceResult &&
        typeof spaceResult === 'object' &&
        'found' in spaceResult &&
        spaceResult.found === true &&
        'space' in spaceResult &&
        spaceResult.space &&
        typeof spaceResult.space === 'object'
      ) {
        const space = spaceResult.space as {
          title?: string;
          description?: string | null;
          memberCount?: number;
        };
        const title =
          typeof space.title === 'string' && space.title.trim()
            ? space.title.trim()
            : safe;
        const description =
          typeof space.description === 'string' && space.description.trim()
            ? space.description.trim()
            : null;
        const memberLine =
          typeof space.memberCount === 'number'
            ? `${space.memberCount} member${
                space.memberCount === 1 ? '' : 's'
              }.`
            : null;
        const text = [
          `You are currently in **${title}**.`,
          description,
          memberLine,
        ]
          .filter((line): line is string => Boolean(line?.trim()))
          .join('\n\n');
        return { kind: 'current_space', text };
      }
    }

    if (isBlindspotQuestion(lastUserText)) {
      const signalsTool = createGetSignalsBySpaceSlugTool(authToken);
      const signalsResult = await signalsTool.execute({
        space_slug: safe,
        include_archived: false,
        order_by: 'mostrecent',
        limit: 100,
      });

      if (
        signalsResult &&
        typeof signalsResult === 'object' &&
        'found' in signalsResult &&
        signalsResult.found === true &&
        'summary' in signalsResult &&
        signalsResult.summary &&
        typeof signalsResult.summary === 'object' &&
        'signal_taxonomy' in signalsResult &&
        signalsResult.signal_taxonomy &&
        typeof signalsResult.signal_taxonomy === 'object'
      ) {
        const summary = signalsResult.summary as Record<string, unknown>;
        const taxonomy = signalsResult.signal_taxonomy as Record<
          string,
          unknown
        >;
        const byType =
          'by_type' in summary &&
          summary.by_type &&
          typeof summary.by_type === 'object'
            ? (summary.by_type as Record<string, unknown>)
            : {};
        const allowedTypes = Array.isArray(taxonomy.allowed_types)
          ? (taxonomy.allowed_types as string[])
          : [];
        const topTags = Array.isArray(summary.top_tags)
          ? (summary.top_tags as Array<Record<string, unknown>>)
          : [];

        const leastCoveredType =
          allowedTypes
            .map((type) => ({
              type,
              count:
                typeof byType[type] === 'number' ? Number(byType[type]) : 0,
            }))
            .sort((a, b) => a.count - b.count)[0]?.type ?? 'opportunity';

        const leadingTag =
          topTags.find(
            (entry) =>
              typeof entry.tag === 'string' &&
              String(entry.tag).trim().length > 0,
          )?.tag ?? 'coordination';

        const text = [
          `Main blindspot for "${safe}": coverage is thinnest in **${leastCoveredType}** signals.`,
          '',
          `Why: this type appears underrepresented relative to others, while current discussion energy clusters around **${String(
            leadingTag,
          )}**.`,
          '',
          `Practical next move: create one ${leastCoveredType} signal tied to ${String(
            leadingTag,
          )} with a clear 2-week measurable outcome and owner.`,
          '',
          'I used deterministic signal-board data because the external model provider is currently unavailable.',
        ].join('\n');

        return { kind: 'blindspot', text };
      }
    }

    if (isSignalRecommendationQuestion(lastUserText)) {
      const signalsTool = createGetSignalsBySpaceSlugTool(authToken);
      const signalsResult = await signalsTool.execute({
        space_slug: safe,
        include_archived: false,
        order_by: 'mostrecent',
        limit: 100,
      });

      if (
        signalsResult &&
        typeof signalsResult === 'object' &&
        'found' in signalsResult &&
        signalsResult.found === true &&
        'summary' in signalsResult &&
        signalsResult.summary &&
        typeof signalsResult.summary === 'object' &&
        'signal_taxonomy' in signalsResult &&
        signalsResult.signal_taxonomy &&
        typeof signalsResult.signal_taxonomy === 'object'
      ) {
        const summary = signalsResult.summary as Record<string, unknown>;
        const taxonomy = signalsResult.signal_taxonomy as Record<
          string,
          unknown
        >;
        const byType =
          'by_type' in summary &&
          summary.by_type &&
          typeof summary.by_type === 'object'
            ? (summary.by_type as Record<string, unknown>)
            : {};
        const allowedTypes = Array.isArray(taxonomy.allowed_types)
          ? (taxonomy.allowed_types as string[])
          : [];
        const topTags = Array.isArray(summary.top_tags)
          ? (summary.top_tags as Array<Record<string, unknown>>)
          : [];

        const leastCoveredType =
          allowedTypes
            .map((type) => ({
              type,
              count:
                typeof byType[type] === 'number' ? Number(byType[type]) : 0,
            }))
            .sort((a, b) => a.count - b.count)[0]?.type ?? 'opportunity';

        const suggestedTag =
          topTags.find(
            (t) => typeof t.tag === 'string' && String(t.tag).trim().length > 0,
          )?.tag ?? 'coordination';

        const recommendation = [
          `Recommendation for "${safe}":`,
          `- Action: Create one ${leastCoveredType} signal on ${String(
            suggestedTag,
          )}.`,
          `- Why now: ${leastCoveredType} is underrepresented in the current signal mix.`,
          '- Expected impact: better portfolio balance and clearer execution focus.',
          `- First step: draft "Improve ${String(
            suggestedTag,
          )} execution loop", set one 2-week KPI, assign one owner.`,
          '- Confidence: 74%',
          'I used deterministic signal-board data because the external model provider is currently unavailable.',
        ].join('\n');

        return { kind: 'signal_recommendation', text: recommendation };
      }
    }

    if (isTokenQuestion(lastUserText)) {
      const tokenTool = createGetTokenHoldingsBySpaceSlugTool(authToken);
      const tokenResult = await tokenTool.execute({
        space_slug: safe,
        include_zero_balances: false,
        include_treasury: true,
      });
      if (
        tokenResult &&
        typeof tokenResult === 'object' &&
        'found' in tokenResult &&
        tokenResult.found === true &&
        'tokens' in tokenResult &&
        Array.isArray(tokenResult.tokens)
      ) {
        const tokens = tokenResult.tokens as Array<Record<string, unknown>>;
        if (tokens.length === 0) {
          return {
            kind: 'tokens',
            text: `No token holdings were found for "${safe}" in the current space snapshot.`,
          };
        }

        const lines = [
          `Token holdings for "${safe}" (${tokens.length} tokens):`,
        ];
        tokens.slice(0, 8).forEach((h, idx) => {
          const symbol =
            typeof h.symbol === 'string' && h.symbol.trim()
              ? h.symbol.trim()
              : typeof h.token_symbol === 'string'
              ? String(h.token_symbol)
              : 'TOKEN';
          const treasuryPct =
            typeof h.treasury_balance === 'string' && h.treasury_balance.trim()
              ? `treasury: ${h.treasury_balance.trim()}`
              : null;
          const totalSupply =
            typeof h.total_supply === 'string' && h.total_supply.trim()
              ? `supply: ${h.total_supply.trim()}`
              : null;
          const bits = [treasuryPct, totalSupply].filter(Boolean).join(', ');
          lines.push(`${idx + 1}. ${symbol}${bits ? ` (${bits})` : ''}`);
        });
        lines.push(
          'I used deterministic token holdings data because the external model provider is currently unavailable.',
        );
        return { kind: 'tokens', text: lines.join('\n') };
      }
    }

    if (isDiscussionQuestion(lastUserText)) {
      const signalsTool = createGetSignalsBySpaceSlugTool(authToken);
      const signalsResult = await signalsTool.execute({
        space_slug: safe,
        include_archived: false,
        order_by: 'mostmessages',
        limit: 8,
      });
      if (
        signalsResult &&
        typeof signalsResult === 'object' &&
        'found' in signalsResult &&
        signalsResult.found === true &&
        'signals' in signalsResult &&
        Array.isArray(signalsResult.signals)
      ) {
        const signals = signalsResult.signals as Array<Record<string, unknown>>;
        if (signals.length === 0) {
          return {
            kind: 'discussions',
            text: `No active discussions/signals were found for "${safe}".`,
          };
        }
        const lines = [`Main discussions/signals for "${safe}":`];
        signals.slice(0, 8).forEach((s, idx) => {
          const title =
            typeof s.title === 'string' && s.title.trim()
              ? s.title.trim()
              : '(untitled signal)';
          const priority =
            typeof s.priority === 'string' && s.priority.trim()
              ? `priority: ${s.priority.trim()}`
              : null;
          const messages =
            typeof s.messages === 'number' ? `${s.messages} messages` : null;
          const bits = [priority, messages].filter(Boolean).join(', ');
          lines.push(`${idx + 1}. ${title}${bits ? ` (${bits})` : ''}`);
        });
        lines.push('');
        lines.push(
          'I used deterministic discussions data because the external model provider is currently unavailable.',
        );
        return { kind: 'discussions', text: lines.join('\n') };
      }
    }

    if (isDocumentsQuestion(lastUserText)) {
      const docsTool = createGetDocumentsBySpaceSlugTool(authToken);
      const docsResult = await docsTool.execute({
        space_slug: safe,
        page: 1,
        page_size: 8,
      });
      if (
        docsResult &&
        typeof docsResult === 'object' &&
        'found' in docsResult &&
        docsResult.found === true &&
        'documents' in docsResult &&
        Array.isArray(docsResult.documents)
      ) {
        const docs = docsResult.documents as Array<Record<string, unknown>>;
        const summary: string[] = [];
        summary.push(`Documents for "${safe}" (${docs.length} shown):`);
        docs.slice(0, 8).forEach((doc, idx) => {
          const title =
            typeof doc.title === 'string' && doc.title.trim()
              ? doc.title.trim()
              : '(untitled)';
          const state =
            typeof doc.state === 'string' && doc.state.trim()
              ? doc.state.trim()
              : 'unknown';
          const status =
            typeof doc.status === 'string' && doc.status.trim()
              ? `, status: ${doc.status.trim()}`
              : '';
          summary.push(`${idx + 1}. ${title} (${state}${status})`);
        });
        summary.push(
          'I used deterministic space documents data because the external model provider is currently unavailable.',
        );
        return { kind: 'documents', text: summary.join('\n') };
      }
    }

    if (isEcosystemQuestion(lastUserText)) {
      const ecosystemTool = createGetEcosystemBySpaceSlugTool(authToken);
      const ecosystemResult = await ecosystemTool.execute({
        space_slug: safe,
        include_archived: false,
      });
      if (
        ecosystemResult &&
        typeof ecosystemResult === 'object' &&
        'found' in ecosystemResult &&
        ecosystemResult.found === true &&
        'ecosystem' in ecosystemResult &&
        ecosystemResult.ecosystem &&
        typeof ecosystemResult.ecosystem === 'object' &&
        'spaces' in ecosystemResult &&
        Array.isArray(ecosystemResult.spaces)
      ) {
        const eco = ecosystemResult.ecosystem as Record<string, unknown>;
        const spaces = ecosystemResult.spaces as Array<Record<string, unknown>>;
        const rootSlug =
          'root_space_slug' in ecosystemResult &&
          typeof ecosystemResult.root_space_slug === 'string'
            ? ecosystemResult.root_space_slug
            : safe;

        const top = spaces.slice(0, 8).map((s) => {
          const title =
            typeof s.title === 'string' && s.title.trim()
              ? s.title.trim()
              : typeof s.slug === 'string'
              ? s.slug
              : 'space';
          const children = Array.isArray(s.child_space_ids)
            ? s.child_space_ids.length
            : 0;
          return `- ${title} (${children} direct subspaces)`;
        });

        const lines = [
          `Ecosystem structure for "${safe}"`,
          `Root: ${rootSlug}`,
          `Total spaces: ${
            typeof eco.space_count === 'number'
              ? eco.space_count
              : spaces.length
          }`,
          ...top,
          'I used deterministic ecosystem data because the external model provider is currently unavailable.',
        ];
        return { kind: 'ecosystem', text: lines.join('\n') };
      }
    }

    const overviewIntent = getSpaceOverviewIntent(lastUserText);
    if (overviewIntent) {
      const result = await getSpaceBySlugTool.execute({ slug: safe });
      if (!result || typeof result !== 'object') return null;

      const found =
        'found' in result && typeof result.found === 'boolean'
          ? result.found
          : false;
      if (!found) return null;

      const space =
        'space' in result &&
        result.space &&
        typeof result.space === 'object' &&
        !Array.isArray(result.space)
          ? result.space
          : null;
      if (!space) return null;

      const title =
        'title' in space && typeof space.title === 'string'
          ? space.title
          : safe;
      const description =
        'description' in space && typeof space.description === 'string'
          ? space.description.trim()
          : '';
      const memberCount =
        'memberCount' in space && typeof space.memberCount === 'number'
          ? space.memberCount
          : null;
      const documentCount =
        'documentCount' in space && typeof space.documentCount === 'number'
          ? space.documentCount
          : null;
      const subspaceCount =
        'subspaceCount' in space && typeof space.subspaceCount === 'number'
          ? space.subspaceCount
          : null;

      if (overviewIntent === 'member_count') {
        return {
          kind: 'space_overview',
          text:
            memberCount != null
              ? `This space currently has ${memberCount} members.\n\nI used cached Hypha space data because the external model provider is currently unavailable.`
              : 'I could not determine the current member count from cached data.',
        };
      }

      if (overviewIntent === 'document_count') {
        return {
          kind: 'space_overview',
          text:
            documentCount != null
              ? `This space currently has ${documentCount} documents/agreements.\n\nI used cached Hypha space data because the external model provider is currently unavailable.`
              : 'I could not determine the current document count from cached data.',
        };
      }

      if (overviewIntent === 'subspace_count') {
        return {
          kind: 'space_overview',
          text:
            subspaceCount != null
              ? `This space currently has ${subspaceCount} subspaces.\n\nI used cached Hypha space data because the external model provider is currently unavailable.`
              : 'I could not determine the current subspace count from cached data.',
        };
      }

      const lines = [`${title}`];
      if (description) lines.push(description);
      const statBits = [
        memberCount != null ? `${memberCount} members` : null,
        documentCount != null ? `${documentCount} documents` : null,
        subspaceCount != null ? `${subspaceCount} subspaces` : null,
      ].filter(Boolean);
      if (statBits.length > 0) {
        lines.push(`Quick stats: ${statBits.join(', ')}.`);
      }
      lines.push(
        'I used cached Hypha space data because the external model provider is currently unavailable.',
      );
      return { kind: 'space_overview', text: lines.join('\n\n') };
    }

    // No deterministic intent match -> do not return stale generic overview.
    return null;
  } catch (error) {
    console.error('[chat][fallback][space-overview][failed]', {
      debugRequestId,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Maps common OpenRouter auth / auto-router failures to visible assistant text so the
 * UI stream does not emit a fatal `error` chunk (which becomes `useChat` Error: User not found).
 */
function createOpenRouterAuthRecoveryTransform(
  debugRequestId: string,
  deterministicFallback: DeterministicFallbackContext | null,
): StreamTextTransform<ToolSet> {
  return () => {
    const nextTextId = createIdGenerator({ prefix: 't', size: 12 });
    return new TransformStream<
      TextStreamPart<ToolSet>,
      TextStreamPart<ToolSet>
    >({
      transform(chunk, controller) {
        if (chunk.type !== 'error') {
          controller.enqueue(chunk);
          return;
        }

        const err = chunk.error;
        const message = messageFromUnknownError(err);
        const lower = message.toLowerCase();
        const looksLikeUserNotFound = lower.includes('user not found');
        const openRouter401 =
          APICallError.isInstance(err) && err.statusCode === 401;
        const retryableApiError =
          APICallError.isInstance(err) &&
          typeof err.statusCode === 'number' &&
          isRetryableStatus(err.statusCode);
        const looksLikeTransient =
          lower.includes('fetch failed') ||
          lower.includes('timeout') ||
          lower.includes('network') ||
          lower.includes('socket') ||
          lower.includes('circuit open');

        if (
          looksLikeUserNotFound ||
          openRouter401 ||
          retryableApiError ||
          looksLikeTransient
        ) {
          console.error('[chat][openrouter][stream-auth-failure]', {
            debugRequestId,
            message,
            ...(APICallError.isInstance(err)
              ? { statusCode: err.statusCode, url: err.url }
              : {}),
          });
          const id = nextTextId();
          controller.enqueue({ type: 'text-start', id });
          controller.enqueue({
            type: 'text-delta',
            id,
            text:
              deterministicFallback?.text ??
              (openRouter401 || looksLikeUserNotFound
                ? OPENROUTER_AUTH_FAILURE_REPLY
                : OPENROUTER_TEMP_UNAVAILABLE_REPLY),
          });
          controller.enqueue({ type: 'text-end', id });
          return;
        }

        controller.enqueue(chunk);
      },
    });
  };
}

/** Narrowed shape when `isAbortLikeError` returns true (abort-like DOM/undici errors). */
export type AbortLikeCandidate = { name?: string; message?: string };

export function isAbortLikeError(error: unknown): error is AbortLikeCandidate {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as AbortLikeCandidate;
  return (
    maybeError.name === 'AbortError' ||
    maybeError.message?.toLowerCase().includes('aborted') === true
  );
}

export type ChatStreamCallbacks = {
  debugRequestId: string;
  /** Lets org memory resolve the viewer's Matrix token (same as Space Memory API). */
  requestUrlForSessionMatrix?: string;
  activeSpaceTitle?: string | null;
  conversationContext?: ChatRequestPayload['conversationContext'];
  onboardingWriteToolsEnabled?: boolean;
  ecosystemAutomationEnabled?: boolean;
};

function sanitizeMessagesToTextOnly(
  messages: ChatRequestPayload['messages'],
): UIMessage[] {
  return messages
    .map((message) => {
      const safeRole: UIMessage['role'] =
        message.role === 'system' ||
        message.role === 'user' ||
        message.role === 'assistant'
          ? message.role
          : 'user';

      const explicitTextParts = (message.parts ?? [])
        .filter(
          (part): part is { type: 'text'; text: string } =>
            part != null &&
            typeof part === 'object' &&
            part.type === 'text' &&
            typeof (part as { text?: unknown }).text === 'string',
        )
        .map((part) => ({ type: 'text' as const, text: part.text }));

      const fileParts = (message.parts ?? []).flatMap((part) => {
        if (part == null || typeof part !== 'object') return [];
        const candidate = part as Record<string, unknown>;
        if (candidate.type !== 'file') return [];
        const rawUrl = typeof candidate.url === 'string' ? candidate.url : '';
        const url = rawUrl.trim();
        if (!url) return [];
        const mediaType =
          typeof candidate.mediaType === 'string' && candidate.mediaType.trim()
            ? candidate.mediaType
            : 'application/octet-stream';
        return [{ type: 'file' as const, mediaType, url }];
      });

      const hadFileCandidates = (message.parts ?? []).some((part) => {
        if (part == null || typeof part !== 'object') return false;
        const candidate = part as Record<string, unknown>;
        if (candidate.type === 'file') return true;
        const rawUrl = typeof candidate.url === 'string' ? candidate.url : '';
        return rawUrl.trim().length > 0;
      });
      const hasFileParts = fileParts.length > 0;

      /** Keep a short hint only when files exist but could not be normalized. */
      const fileOnlySynthetic =
        explicitTextParts.length === 0 && hadFileCandidates && !hasFileParts
          ? [
              {
                type: 'text' as const,
                text: '[User attached file(s) with no text. Use tools (org memory, documents, etc.) as needed; if context is insufficient, ask a short clarifying question.]',
              },
            ]
          : [];

      const fallbackTextParts =
        explicitTextParts.length > 0
          ? explicitTextParts
          : fileOnlySynthetic.length > 0
          ? fileOnlySynthetic
          : typeof message.content === 'string' &&
            message.content.trim().length > 0
          ? [{ type: 'text' as const, text: message.content }]
          : [];
      const normalizedParts = [...fallbackTextParts, ...fileParts];

      return {
        id: message.id,
        role: safeRole,
        parts: normalizedParts,
      };
    })
    .filter((message) => message.parts.length > 0);
}

function extractLastUserText(
  messages: ChatRequestPayload['messages'],
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message) continue;
    if (message.role !== 'user') continue;
    const parts = message.parts ?? [];
    for (const part of parts) {
      if (
        part &&
        typeof part === 'object' &&
        part.type === 'text' &&
        'text' in part &&
        typeof part.text === 'string'
      ) {
        const text = part.text.trim();
        if (text) return text;
      }
    }
    if (typeof message.content === 'string' && message.content.trim()) {
      return message.content.trim();
    }
  }
  return null;
}

function extractRecentUserTexts(
  messages: ChatRequestPayload['messages'],
  limit = 10,
): string[] {
  const texts: string[] = [];
  for (let i = messages.length - 1; i >= 0 && texts.length < limit; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== 'user') continue;
    const parts = message.parts ?? [];
    let found = false;
    for (const part of parts) {
      if (
        part &&
        typeof part === 'object' &&
        part.type === 'text' &&
        'text' in part &&
        typeof part.text === 'string'
      ) {
        const text = part.text.trim();
        if (text) {
          texts.push(text);
          found = true;
          break;
        }
      }
    }
    if (
      !found &&
      typeof message.content === 'string' &&
      message.content.trim()
    ) {
      texts.push(message.content.trim());
    }
  }
  return texts;
}

function normalizeConversationContext(
  context: ChatRequestPayload['conversationContext'],
  lastUserText: string | null,
): ChatRequestPayload['conversationContext'] {
  if (!context || context.mode !== 'onboarding_setup') return context;
  return {
    ...context,
    setupPhase: context.setupPhase ?? (lastUserText ? 'draft' : 'discover'),
    ...(lastUserText ? { lastUserText } : {}),
  };
}

function buildEffectiveSystemPrompt(
  spaceSlug: string | null | undefined,
  lastUserText: string | null,
  conversationContext: ChatRequestPayload['conversationContext'],
  spaceContextSnapshot: string | null,
): string {
  const basePrompt = buildSystemPrompt(spaceSlug);
  const parts = [basePrompt];
  if (spaceContextSnapshot) {
    parts.push(`\n\n${spaceContextSnapshot}`);
  }
  const inOnboarding = conversationContext?.mode === 'onboarding_setup';
  const postCreateOnboardingPhase =
    conversationContext?.setupPhase === 'execute' ||
    conversationContext?.setupPhase === 'verify';
  if (spaceSlug?.trim() && (!inOnboarding || postCreateOnboardingPhase)) {
    parts.push(LEFT_PANEL_NAVIGATION_GUIDELINES);
  }
  const competencyDirective = buildQuestionCompetencyDirective(lastUserText);
  if (competencyDirective) {
    parts.push(`\n\n${competencyDirective}`);
  }
  return parts.join('');
}

async function buildSpaceContextSnapshot(
  spaceSlug: string,
  clientTitle?: string | null,
): Promise<string | null> {
  const safe = sanitizeSlug(spaceSlug);
  if (!safe) return null;

  try {
    const result = await getSpaceBySlugTool.execute({ slug: safe });
    if (
      !result ||
      typeof result !== 'object' ||
      !('found' in result) ||
      result.found !== true ||
      !('space' in result) ||
      !result.space ||
      typeof result.space !== 'object'
    ) {
      return null;
    }

    const space = result.space as {
      title?: string;
      description?: string | null;
      memberCount?: number;
      documentCount?: number;
    };
    const title = typeof space.title === 'string' ? space.title : safe;
    const description =
      typeof space.description === 'string' && space.description.trim()
        ? space.description.trim()
        : null;

    return [
      'CRITICAL — ACTIVE SPACE CONTEXT (this overrides any other space name from earlier chat turns):',
      `- Active space slug for tools: ${safe}`,
      `- Display name: ${title}`,
      ...(clientTitle && clientTitle !== title
        ? [`- Client-reported title: ${clientTitle}`]
        : []),
      ...(description ? [`- Purpose: ${description}`] : []),
      ...(typeof space.memberCount === 'number'
        ? [`- Members: ${space.memberCount}`]
        : []),
      ...(typeof space.documentCount === 'number'
        ? [`- Documents: ${space.documentCount}`]
        : []),
      ...(typeof (space as { activationMode?: string }).activationMode ===
      'string'
        ? [
            `- Activation mode: ${
              (space as { activationMode: string }).activationMode
            }`,
          ]
        : []),
      ...((
        space as { privacy?: { isAlreadyPrivate?: boolean; summary?: string } }
      ).privacy?.summary
        ? [
            `- Privacy: ${
              (space as { privacy: { summary: string } }).privacy.summary
            }`,
          ]
        : []),
      `- The user switched to this space via navigation, the space picker, or recently visited. Answer ONLY about this space unless they explicitly ask about another.`,
      `- For "which space am I in" / "where am I" questions: answer with "${title}" and call get_space_by_slug with slug "${safe}". Never name a different space from chat history.`,
      `- Privacy/transparency changes on existing spaces require create_space_setup_proposal (proposal_type space_transparency) and member vote — never claim updates via update_space_settings.`,
    ].join('\n');
  } catch {
    return null;
  }
}

async function convertMessagesSafely(
  messages: ChatRequestPayload['messages'],
  debugRequestId: string,
): Promise<Awaited<ReturnType<typeof convertToModelMessages>>> {
  try {
    // Always normalize to explicit text parts first. Some clients send `content`
    // with empty `parts`; relying on raw conversion can silently yield empty prompts.
    const sanitized = sanitizeMessagesToTextOnly(messages);
    if (sanitized.length > 0) {
      return await convertToModelMessages(sanitized);
    }

    const lastUserText = extractLastUserText(messages);
    if (lastUserText) {
      return convertToModelMessages([
        {
          role: 'user',
          parts: [{ type: 'text', text: lastUserText }],
        },
      ]);
    }
    return [];
  } catch (error) {
    console.error('[chat][convert-messages][failed]', {
      debugRequestId,
      message: error instanceof Error ? error.message : String(error),
      ...(OPENROUTER_DEBUG && { error }),
    });
    return [];
  }
}

export async function createChatStreamResult(
  messages: ChatRequestPayload['messages'],
  spaceSlug: string | null | undefined,
  authToken: string,
  {
    debugRequestId,
    requestUrlForSessionMatrix,
    activeSpaceTitle,
    conversationContext,
    onboardingWriteToolsEnabled,
    ecosystemAutomationEnabled,
  }: ChatStreamCallbacks,
): Promise<ReturnType<typeof streamText>> {
  const modelMessages = await convertMessagesSafely(messages, debugRequestId);
  const lastUserText = extractLastUserText(messages);
  const recentUserTexts = extractRecentUserTexts(messages);
  const normalizedConversationContext = normalizeConversationContext(
    conversationContext,
    lastUserText,
  );
  const tools = createChatTools(
    authToken,
    requestUrlForSessionMatrix,
    normalizedConversationContext,
    {
      onboardingWriteToolsEnabled: onboardingWriteToolsEnabled !== false,
      ecosystemAutomationEnabled: ecosystemAutomationEnabled !== false,
    },
    lastUserText,
    recentUserTexts,
  );
  const deterministicFallback = await buildDeterministicSpaceFallback({
    lastUserText,
    spaceSlug,
    authToken,
    debugRequestId,
  });
  const spaceContextSnapshot = spaceSlug?.trim()
    ? await buildSpaceContextSnapshot(spaceSlug, activeSpaceTitle)
    : null;
  const effectiveSystemPrompt = buildEffectiveSystemPrompt(
    spaceSlug,
    lastUserText,
    normalizedConversationContext,
    spaceContextSnapshot,
  );
  const onboardingLocaleDirective =
    normalizedConversationContext?.mode === 'onboarding_setup'
      ? buildOnboardingLocaleDirective(normalizedConversationContext.locale)
      : null;
  const ecosystemExecuteDirective =
    normalizedConversationContext?.mode === 'onboarding_setup'
      ? buildEcosystemExecutePhaseDirective(normalizedConversationContext)
      : null;
  const systemPrompt =
    normalizedConversationContext?.mode === 'onboarding_setup'
      ? `${effectiveSystemPrompt}\n\nOnboarding setup mode is active (from the onboarding page or the left AI panel).\n- Act as a setup architect and trusted advisor for creating and configuring spaces or full ecosystems.\n- ALWAYS call onboarding_guidance(process: create_space) at the start of each discover-phase turn before asking questions or calling write tools.\n- Before any write action, present a concise action plan and request explicit confirmation.\n- Keep track of setup state (discover -> draft -> confirm -> execute -> verify) in your responses.\n- Current setup phase: ${
          normalizedConversationContext.setupPhase ?? 'discover'
        }.\n- Discovery order: (1) journey cards (single space vs ecosystem), (2) name and purpose, (3) propose general principles and get user reaction, (4) org discovery (industry, community size, core team—category tags auto-assigned from the ten fixed Hypha groups, never custom tags), (5) ecosystem structure from public network patterns if applicable, (6) activation mode cards (Sandbox Mode, Pilot Mode, Live Mode only—never entry method here), (7) transparency matrix UI (separate discoverability + activity—four levels each, never three combined options in text), (8) entry method cards (open access, invite/request, token-based), (9) location map UI or skip, (10) logo and hero banner—ask upload first; if they have none, offer to generate and call generate_space_visual_assets with user confirmation before any create_space_from_onboarding or wallet signing.\n- Never skip to activation, transparency, entry method, wallet signing, or create_space_from_onboarding until name, purpose, principles_reaction, org_discovery, and visual assets (logo_url + lead_image_url) are complete.\n- After org discovery, use assigned_category_groups and suggested_categories from onboarding_guidance—do not ask users to confirm or invent tags.\n- For ecosystem onboarding: call get_network_ecosystem_patterns (public, non-sandbox spaces only), ask root-space role, propose_organisation_blueprint, complete visual assets, create the root space first, then continue child spaces from the left AI panel with 3-4 proposed child spaces. After root creation the user lands on the ecosystem navigation view with the AI panel open.\n- After single-space onboarding creation, the user lands on the coherence view with the AI panel open—finish voting method and entry method setup first, then help with the first signal once governance basics are settled.\n- When the user selects journey, activation, transparency, entry method, or location via onboarding UI, pass values into onboarding_guidance known_answers and create tools. For location, always use the address search and map card—never ask users to confirm latitude or longitude in chat.\n- After wallet handoff, instruct the user to complete the wallet signing prompt (standard signatures and 2FA/MFA wallets). If signing fails, explain clearly and offer retry—never loop on verbal confirmations.${
          resolveLatestVisualGenerationIntent(recentUserTexts)
            ? '\n- The user asked for generated visuals in this thread. You MUST call generate_space_visual_assets or create_space_from_onboarding with generate_visuals=true in this turn. Never say images must wait until after creation.'
            : ''
        }${
          normalizedConversationContext.setupPhase === 'execute' ||
          normalizedConversationContext.setupPhase === 'verify'
            ? '\n- Post-create phase (space is live): finish governance setup before signals or member-gated read tools. Ask voting method first — the user picks with the voting method card in the panel. Then confirm entry method with the entry method card if it was skipped during discover. Use mcp_navigation to agreements/create/change-voting-method when the user is ready to submit the on-chain voting-method proposal. Do NOT call get_signals_by_space_slug or other member-gated tools until voting method and entry method are settled.'
            : ''
        }${
          normalizedConversationContext.setupPhase === 'confirm'
            ? '\n- The user already confirmed creation in this thread. Do not ask for another confirmation. Proceed with create_space_from_onboarding (no dry_run) only when logo_url and lead_image_url are set, then wallet signing.'
            : ''
        }${ecosystemExecuteDirective ? `\n${ecosystemExecuteDirective}` : ''}${
          normalizedConversationContext.discoveryMode === 'voice_interview'
            ? '\n- Voice interview mode is active: speak like a warm human advisor—reflect what you heard, show empathy and enthusiasm, ask one question at a time, keep replies short and conversational (no bullet lists or markdown). Never read chat text or tool output verbatim; summarize the important points in a human way and focus on what matters for the next step. UI cards still appear for structured choices; introduce them naturally without reading every option aloud.'
            : ''
        }${onboardingLocaleDirective ? `\n${onboardingLocaleDirective}` : ''}`
      : effectiveSystemPrompt;

  if (modelMessages.length === 0) {
    console.warn('[chat][empty-model-messages]', {
      debugRequestId,
      spaceSlug: spaceSlug ?? null,
      rawMessageCount: messages.length,
    });
  }

  const openRouterModelId = resolveOpenRouterChatModelId();

  if (OPENROUTER_DEBUG) {
    console.log('[chat][openrouter][start]', {
      debugRequestId,
      model: openRouterModelId,
      messageCount: messages.length,
      spaceSlug: spaceSlug ?? null,
    });
  }

  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error(MISSING_OPENROUTER_KEY_MESSAGE);
  }

  return streamText({
    model: openrouterWithHyphaHeaders(openRouterModelId),
    system: systemPrompt,
    messages:
      modelMessages.length > 0
        ? modelMessages
        : [
            {
              role: 'user',
              content:
                'The latest user message had no readable text (for example, only unsupported attachment parts). Briefly ask the user to type their question in words, or confirm what they need.',
            },
          ],

    // Cast: ChatRouteTool's generic Zod input doesn't satisfy ai's CoreTool typing, but is structurally compatible at runtime.
    tools: tools as unknown as Parameters<typeof streamText>[0]['tools'],
    stopWhen: stepCountIs(6),
    onStepFinish: (event) => {
      if (!OPENROUTER_DEBUG) return;

      console.log('[chat][openrouter][step-finish]', {
        debugRequestId,
        stepNumber: event.stepNumber,
        provider: event.model.provider,
        modelId: event.model.modelId,
        finishReason: event.finishReason,
        responseId: event.response?.id,
        usage: event.usage,
        openrouterProviderMetadata:
          event.providerMetadata &&
          typeof event.providerMetadata === 'object' &&
          'openrouter' in event.providerMetadata
            ? (event.providerMetadata as { openrouter?: unknown }).openrouter
            : undefined,
      });
    },
    onFinish: (event) => {
      if (!OPENROUTER_DEBUG) return;

      const generationId = event.response?.id;
      const generationUrl = generationId
        ? `https://openrouter.ai/api/v1/generation?id=${generationId}`
        : null;

      console.log('[chat][openrouter][finish]', {
        debugRequestId,
        provider: event.model.provider,
        modelId: event.model.modelId,
        responseId: generationId,
        generationUrl,
        finishReason: event.finishReason,
        totalUsage: event.totalUsage,
        warnings: event.warnings,
      });
    },
    onError: ({ error }) => {
      if (isAbortLikeError(error)) {
        if (OPENROUTER_DEBUG) {
          console.warn('[chat][openrouter][abort]', { debugRequestId });
        }
        return;
      }
      const base = {
        debugRequestId,
        message: error instanceof Error ? error.message : String(error),
        ...(APICallError.isInstance(error)
          ? { statusCode: error.statusCode, url: error.url }
          : {}),
        ...(OPENROUTER_DEBUG && { error }),
      };
      console.error('[chat][openrouter][error]', base);
    },

    experimental_transform: createOpenRouterAuthRecoveryTransform(
      debugRequestId,
      deterministicFallback,
    ),
  });
}
