import { describe, expect, it } from 'vitest';

import { webSearchTool } from '../web-search';

describe('webSearchTool', () => {
  it('returns structured results for a broad query', async () => {
    const result = await webSearchTool.execute({
      query: 'community football club governance',
      max_results: 3,
    });

    expect(result).toMatchObject({ ok: true });
    if (!('results' in result) || !Array.isArray(result.results)) {
      throw new Error('Expected successful web search results');
    }
    expect(result.results.length).toBeGreaterThanOrEqual(0);
  }, 20_000);

  it('rejects empty query', async () => {
    const result = await webSearchTool.execute({
      query: '  ',
      max_results: 5,
    });
    expect(result).toMatchObject({ ok: false });
  });
});
