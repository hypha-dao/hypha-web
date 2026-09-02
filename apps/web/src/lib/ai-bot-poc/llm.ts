// server-only: reached only from API route handlers (#2485 POC).

import { generateText, stepCountIs, type ToolSet } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

/**
 * #2485 POC — thin LLM wrapper.
 *
 * Provider resolution is a small strategy chain so the demo box is not tied to one key:
 *   1. `OPENROUTER_API_KEY`  → OpenRouter (can itself proxy `openai/*`, `anthropic/*`, …).
 *   2. (future slot) `OPENAI_API_KEY` → direct OpenAI — NOT wired in this POC (needs
 *      `@ai-sdk/openai`); left as an explicit throw so the gap is visible, not silent.
 *
 * Model id: `AI_BOT_POC_MODEL` › `OPENROUTER_CHAT_MODEL` › `openai/gpt-4o-mini`.
 */

const DEFAULT_MODEL_ID = 'openai/gpt-4o-mini';
const MAX_STEPS = 4;

export class LlmConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmConfigError';
  }
}

export class LlmCallError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'LlmCallError';
  }
}

interface ResolvedProvider {
  label: string;
  run: (args: {
    system: string;
    prompt: string;
    tools?: ToolSet;
  }) => Promise<string>;
}

function resolveModelId(override: string | null): string {
  return (
    override || process.env.OPENROUTER_CHAT_MODEL?.trim() || DEFAULT_MODEL_ID
  );
}

function resolveProvider(modelOverride: string | null): ResolvedProvider {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey) {
    const provider = createOpenRouter({
      apiKey: openRouterKey,
      compatibility: 'strict',
    });
    const modelId = resolveModelId(modelOverride);
    const model = provider(modelId);
    return {
      label: `openrouter:${modelId}`,
      run: async ({ system, prompt, tools }) => {
        const { text } = await generateText({
          model,
          system,
          prompt,
          tools,
          stopWhen: stepCountIs(MAX_STEPS),
        });
        return text;
      },
    };
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    throw new LlmConfigError(
      'OPENAI_API_KEY is set but the direct-OpenAI strategy is not wired in this POC — ' +
        'set OPENROUTER_API_KEY instead (OpenRouter can proxy openai/* models).',
    );
  }

  throw new LlmConfigError(
    'No LLM provider configured — set OPENROUTER_API_KEY for the #2485 POC.',
  );
}

export interface AnswerInput {
  system: string;
  question: string;
  tools?: ToolSet;
  modelOverride?: string | null;
}

/** Runs one bounded generate loop. Throws `LlmConfigError` / `LlmCallError`. */
export async function answer({
  system,
  question,
  tools,
  modelOverride = null,
}: AnswerInput): Promise<{ text: string; providerLabel: string }> {
  const provider = resolveProvider(modelOverride);
  try {
    const text = await provider.run({ system, prompt: question, tools });
    const trimmed = text.trim();
    if (!trimmed) {
      throw new LlmCallError('model returned an empty response');
    }
    return { text: trimmed, providerLabel: provider.label };
  } catch (error) {
    if (error instanceof LlmCallError || error instanceof LlmConfigError)
      throw error;
    throw new LlmCallError(
      error instanceof Error ? error.message : 'LLM call failed',
      error,
    );
  }
}
