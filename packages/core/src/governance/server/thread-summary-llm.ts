import 'server-only';

import { generateObject } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';

const threadSummarySchema = z.object({
  summary: z
    .string()
    .min(1)
    .describe('2-4 sentence overview of the thread for catch-up'),
  bullets: z
    .array(z.string().min(1))
    .min(1)
    .max(8)
    .describe('Key points, decisions, and open questions'),
});

export type ThreadSummaryLlmResult = z.infer<typeof threadSummarySchema>;

export type ThreadSummaryMessageLine = {
  sender: string;
  text: string;
};

function buildOpenRouterAppHeaders(): Record<string, string> {
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL?.trim()
      ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`
      : '') ||
    'https://hypha.earth';
  const title = process.env.OPENROUTER_APP_TITLE?.trim() || 'Hypha Platform';
  return { 'HTTP-Referer': referer, 'X-Title': title };
}

const DEFAULT_MODEL = 'openai/gpt-4o-mini';

function resolveModelId(): string {
  const fromEnv = process.env.OPENROUTER_THREAD_SUMMARY_MODEL?.trim();
  if (fromEnv) return fromEnv;
  const chatModel = process.env.OPENROUTER_CHAT_MODEL?.trim();
  if (chatModel && !chatModel.toLowerCase().includes('openrouter/auto')) {
    return chatModel;
  }
  return DEFAULT_MODEL;
}

export async function generateThreadLivingSummaryWithLlm(params: {
  threadTitle?: string | null;
  previousSummary?: string | null;
  messages: ThreadSummaryMessageLine[];
  signal?: AbortSignal;
}): Promise<ThreadSummaryLlmResult | null> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;

  const transcript = params.messages
    .map((line) => `${line.sender}: ${line.text}`)
    .join('\n');
  if (!transcript.trim()) return null;

  const openrouter = createOpenRouter({
    apiKey,
    compatibility: 'strict',
    headers: buildOpenRouterAppHeaders(),
  });

  const title = params.threadTitle?.trim() || 'Conversation thread';
  const prior = params.previousSummary?.trim();

  const generateSummary = generateObject as (options: {
    model: unknown;
    schema: z.ZodType<ThreadSummaryLlmResult>;
    abortSignal?: AbortSignal;
    prompt: string;
  }) => Promise<{ object: ThreadSummaryLlmResult }>;

  const { object } = await generateSummary({
    model: openrouter(resolveModelId()),
    schema: threadSummarySchema,
    abortSignal: params.signal,
    prompt: [
      'You summarize an ongoing team chat thread as a living document.',
      'Write for members catching up and for institutional memory.',
      'Be factual, neutral, and concise. Do not invent decisions.',
      'If the thread is mostly social or inconclusive, say so plainly.',
      '',
      `Thread title: ${title}`,
      prior ? `Previous summary (update and supersede):\n${prior}` : '',
      '',
      'Recent messages (oldest to newest):',
      transcript,
    ]
      .filter(Boolean)
      .join('\n'),
  });

  return object;
}
