import { z } from 'zod';
import type { ChatRouteTool } from './types';

const WEB_SEARCH_TIMEOUT_MS = 10_000;

const inputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(2)
    .describe('Natural-language web search query.'),
  max_results: z.number().int().min(1).max(10).optional().default(5),
});

type DuckDuckGoTopic = {
  Text?: string;
  FirstURL?: string;
  Name?: string;
  Topics?: DuckDuckGoTopic[];
};

type DuckDuckGoResponse = {
  Abstract?: string;
  AbstractText?: string;
  AbstractURL?: string;
  Heading?: string;
  RelatedTopics?: DuckDuckGoTopic[];
};

function flattenTopics(
  topics: DuckDuckGoTopic[] | undefined,
): DuckDuckGoTopic[] {
  if (!topics || topics.length === 0) return [];
  const out: DuckDuckGoTopic[] = [];
  for (const topic of topics) {
    if (topic.FirstURL) out.push(topic);
    if (topic.Topics?.length) out.push(...flattenTopics(topic.Topics));
  }
  return out;
}

export const webSearchTool = {
  description:
    'Search the public web for world knowledge and recent external information. Use when the user asks about topics outside Hypha space data (news, general facts, standards, third-party products, current events).',
  inputSchema,
  execute: async (args) => {
    const parsed = inputSchema.safeParse(args);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.message, query: '' };
    }
    const { query, max_results } = parsed.data;

    const url = new URL('https://api.duckduckgo.com/');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('no_html', '1');
    url.searchParams.set('skip_disambig', '1');

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(WEB_SEARCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        return {
          ok: false,
          query,
          error: `Search request failed with status ${response.status}`,
        };
      }
      const body = (await response.json()) as DuckDuckGoResponse;
      const related = flattenTopics(body.RelatedTopics);
      const topResults = related.slice(0, max_results).map((topic) => ({
        title:
          topic.Text?.split(' - ')[0]?.trim() || topic.Name?.trim() || 'Result',
        url: topic.FirstURL ?? '',
        snippet: topic.Text?.trim() || '',
        source: 'duckduckgo',
      }));

      const abstract = body.AbstractText?.trim();
      const abstractResult =
        abstract && body.AbstractURL
          ? [
              {
                title: body.Heading?.trim() || 'Abstract',
                url: body.AbstractURL,
                snippet: abstract,
                source: 'duckduckgo',
              },
            ]
          : [];

      const results = [...abstractResult, ...topResults].slice(0, max_results);
      return {
        ok: true,
        query,
        results,
        fetched_at: new Date().toISOString(),
      };
    } catch (error) {
      return {
        ok: false,
        query,
        error: error instanceof Error ? error.message : 'Unknown search error',
      };
    }
  },
} satisfies ChatRouteTool<typeof inputSchema>;
