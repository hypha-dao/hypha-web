import { describe, expect, it } from 'vitest';

import { webSearchTool } from '../web-search';

describe('webSearchTool', () => {
  it('returns structured results for a broad query', async () => {
    const result = await webSearchTool.execute({
      query: 'community football club governance',
      max_results: 3,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Array.isArray(result.results)).toBe(true);
  }, 20_000);

  it('rejects empty query', async () => {
    const result = await webSearchTool.execute({ query: '  ' });
    expect(result.ok).toBe(false);
  });
});
