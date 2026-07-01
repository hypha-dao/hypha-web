import { z } from 'zod';
import type { ChatRouteTool } from './types';

const WEB_SEARCH_TIMEOUT_MS = 10_000;
const WEB_SEARCH_USER_AGENT =
  'HyphaAI/1.0 (+https://hypha.earth; research assistant)';

const inputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(2)
    .describe('Natural-language web search query.'),
  max_results: z.number().int().min(1).max(10).optional().default(5),
});

type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: string;
};

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

async function searchDuckDuckGoInstant(
  query: string,
  maxResults: number,
): Promise<WebSearchResult[]> {
  const url = new URL('https://api.duckduckgo.com/');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('no_html', '1');
  url.searchParams.set('skip_disambig', '1');

  const response = await fetch(url, {
    signal: AbortSignal.timeout(WEB_SEARCH_TIMEOUT_MS),
    headers: {
      Accept: 'application/json',
      'User-Agent': WEB_SEARCH_USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`DuckDuckGo request failed with status ${response.status}`);
  }

  const body = (await response.json()) as DuckDuckGoResponse;
  const related = flattenTopics(body.RelatedTopics);
  const topResults = related.slice(0, maxResults).map((topic) => ({
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

  return [...abstractResult, ...topResults].slice(0, maxResults);
}

async function searchWikipedia(
  query: string,
  maxResults: number,
): Promise<WebSearchResult[]> {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'opensearch');
  url.searchParams.set('search', query);
  url.searchParams.set('limit', String(maxResults));
  url.searchParams.set('namespace', '0');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');

  const response = await fetch(url, {
    signal: AbortSignal.timeout(WEB_SEARCH_TIMEOUT_MS),
    headers: {
      Accept: 'application/json',
      'User-Agent': WEB_SEARCH_USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`Wikipedia search failed with status ${response.status}`);
  }

  const body = (await response.json()) as [
    string,
    string[],
    string[],
    string[],
  ];
  const titles = body[1] ?? [];
  const descriptions = body[2] ?? [];
  const urls = body[3] ?? [];

  return titles.slice(0, maxResults).map((title, index) => ({
    title,
    url: urls[index] ?? '',
    snippet: descriptions[index]?.trim() || '',
    source: 'wikipedia',
  }));
}

export const webSearchTool = {
  description:
    'Search the public web for world knowledge and recent external information. Use when the user asks about topics outside Hypha space data (news, general facts, standards, third-party products, similar organisations on the internet, current events).',
  inputSchema,
  execute: async (args) => {
    const parsed = inputSchema.safeParse(args);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.message, query: '' };
    }
    const { query, max_results } = parsed.data;

    const errors: string[] = [];
    let results: WebSearchResult[] = [];

    try {
      results = await searchDuckDuckGoInstant(query, max_results);
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : 'DuckDuckGo search failed',
      );
    }

    if (results.length === 0) {
      try {
        results = await searchWikipedia(query, max_results);
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message : 'Wikipedia search failed',
        );
      }
    }

    if (results.length === 0 && errors.length > 0) {
      return {
        ok: false,
        query,
        error: errors.join('; '),
      };
    }

    return {
      ok: true,
      query,
      results,
      fetched_at: new Date().toISOString(),
      ...(results.length === 0
        ? {
            note: 'No web results matched this query. Answer from general knowledge and state that live web results were limited.',
          }
        : {}),
      ...(errors.length > 0 ? { partial_errors: errors } : {}),
    };
  },
} satisfies ChatRouteTool<typeof inputSchema>;
