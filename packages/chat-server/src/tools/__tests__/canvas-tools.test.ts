import { describe, expect, it } from 'vitest';

import {
  createSetCanvasTool,
  createSetNextActionsTool,
  readAllowedWidgetIds,
} from '../canvas-tools';

describe('createSetCanvasTool', () => {
  it('echoes widgets as canvas intents and defaults params to {}', async () => {
    const tool = createSetCanvasTool(['signals', 'treasury']);
    const result = (await tool.execute({
      // `params` omitted on the second widget — the model may leave it out;
      // the tool fills the zod default.
      widgets: [
        { widget_id: 'signals', params: { spaceSlug: 'hypha' } },
        { widget_id: 'treasury', layout_hint: 'aside' },
      ],
    } as never)) as { ok: boolean; canvas: unknown[] };

    expect(result).toEqual({
      ok: true,
      canvas: [
        {
          widgetId: 'signals',
          params: { spaceSlug: 'hypha' },
          layoutHint: undefined,
        },
        { widgetId: 'treasury', params: {}, layoutHint: 'aside' },
      ],
    });
  });

  it('rejects widget ids outside the allowed list and reports them', async () => {
    const tool = createSetCanvasTool(['signals']);
    const result = (await tool.execute({
      widgets: [
        { widget_id: 'signals', params: {} },
        { widget_id: 'ghost', params: {} },
      ],
    })) as { ok: boolean; canvas: unknown[]; rejected?: string[] };

    expect(result.ok).toBe(true);
    expect(result.canvas).toHaveLength(1);
    expect(result.rejected).toEqual(['ghost']);
  });

  it('accepts any widget id when the allowed list is empty', async () => {
    const tool = createSetCanvasTool([]);
    const result = (await tool.execute({
      widgets: [{ widget_id: 'anything', params: {} }],
    })) as { ok: boolean; canvas: unknown[] };
    expect(result.canvas).toHaveLength(1);
  });

  it('returns ok:false for malformed input', async () => {
    const tool = createSetCanvasTool(['signals']);
    const result = (await tool.execute({ widgets: 'nope' } as never)) as {
      ok: boolean;
    };
    expect(result.ok).toBe(false);
  });

  it('rejects more than six widgets', async () => {
    const tool = createSetCanvasTool([]);
    const result = (await tool.execute({
      widgets: Array.from({ length: 7 }, (_, i) => ({
        widget_id: `w${i}`,
        params: {},
      })),
    })) as { ok: boolean };
    expect(result.ok).toBe(false);
  });
});

describe('createSetNextActionsTool', () => {
  it('normalises actions and fills a missing id', async () => {
    const tool = createSetNextActionsTool();
    const result = (await tool.execute({
      actions: [
        { label: 'Show signals', prompt: 'show signals' },
        { id: 'health', label: 'Review stale signals', emphasis: 'guidance' },
      ],
    })) as { ok: boolean; actions: unknown[] };

    expect(result).toEqual({
      ok: true,
      actions: [
        { id: 'na-0', label: 'Show signals', prompt: 'show signals' },
        { id: 'health', label: 'Review stale signals', emphasis: 'guidance' },
      ],
    });
  });

  it('returns ok:false when an action has no label', async () => {
    const tool = createSetNextActionsTool();
    const result = (await tool.execute({
      actions: [{ prompt: 'x' }],
    } as never)) as { ok: boolean };
    expect(result.ok).toBe(false);
  });
});

describe('readAllowedWidgetIds', () => {
  it('reads a string array from the conversation context', () => {
    expect(
      readAllowedWidgetIds({
        mode: 'conversational_canvas',
        widgetIds: ['a', 'b'],
      }),
    ).toEqual(['a', 'b']);
  });

  it('filters out non-strings and returns [] when absent', () => {
    expect(readAllowedWidgetIds({ widgetIds: ['a', 2, null, 'b'] })).toEqual([
      'a',
      'b',
    ]);
    expect(readAllowedWidgetIds({})).toEqual([]);
    expect(readAllowedWidgetIds(undefined)).toEqual([]);
  });
});
