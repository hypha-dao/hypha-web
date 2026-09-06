import { describe, expect, it } from 'vitest';

import {
  createSetCanvasTool,
  createSetNextActionsTool,
  createSetScopeTool,
  readAllowedWidgetIds,
  readKnownSpaces,
  readScopeLocked,
  resolveScopeTarget,
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

describe('resolveScopeTarget', () => {
  const known = [
    { slug: 'hypha', title: 'Hypha' },
    { slug: 'ateneo-de-manila', title: 'Ateneo de Manila' },
    { slug: 'ger-test-video-032' },
  ];

  it('matches an exact slug', () => {
    expect(resolveScopeTarget('ateneo-de-manila', known)).toEqual({
      slug: 'ateneo-de-manila',
      title: 'Ateneo de Manila',
    });
  });

  it('matches a spoken/display name', () => {
    expect(resolveScopeTarget('Ateneo de Manila', known)).toEqual({
      slug: 'ateneo-de-manila',
      title: 'Ateneo de Manila',
    });
  });

  it('matches a spaced form of a title-less slug', () => {
    expect(resolveScopeTarget('ger test video 032', known)).toEqual({
      slug: 'ger-test-video-032',
    });
  });

  it('matches a partial title', () => {
    expect(resolveScopeTarget('manila', known)?.slug).toBe('ateneo-de-manila');
  });

  it('accepts a well-formed slug not in the known list', () => {
    expect(resolveScopeTarget('some-other-space', known)).toEqual({
      slug: 'some-other-space',
    });
  });

  it('slugifies a typed name not in the known list (empty candidates)', () => {
    expect(resolveScopeTarget('BOT Ger Test 030', [])).toEqual({
      slug: 'bot-ger-test-030',
    });
  });

  it('rejects a lone-article free-text reference', () => {
    expect(resolveScopeTarget('the finance one!!', [])).toBeNull();
    expect(resolveScopeTarget('!!!', [])).toBeNull();
  });
});

describe('createSetScopeTool', () => {
  it('echoes the resolved slug + title on success', async () => {
    const tool = createSetScopeTool([{ slug: 'hypha', title: 'Hypha' }]);
    const result = await tool.execute({ space: 'Hypha' } as never);
    expect(result).toEqual({ ok: true, spaceSlug: 'hypha', title: 'Hypha' });
  });

  it('reports failure (with known-space names) only when nothing usable is given', async () => {
    const tool = createSetScopeTool([{ slug: 'hypha', title: 'Hypha' }]);
    const result = (await tool.execute({
      space: '?!?!',
    } as never)) as { ok: boolean; knownSpaces?: string[] };
    expect(result.ok).toBe(false);
    expect(result.knownSpaces).toEqual(['Hypha']);
  });

  it('slugifies a plausible typed name even if not in the known list', async () => {
    const tool = createSetScopeTool([{ slug: 'hypha', title: 'Hypha' }]);
    const result = await tool.execute({ space: 'BOT Ger Test 030' } as never);
    expect(result).toEqual({ ok: true, spaceSlug: 'bot-ger-test-030' });
  });
});

describe('readKnownSpaces / readScopeLocked', () => {
  it('reads known spaces, dropping malformed entries', () => {
    expect(
      readKnownSpaces({
        knownSpaces: [
          { slug: 'hypha', title: 'Hypha' },
          { slug: 'x' },
          { title: 'no slug' },
          null,
        ],
      }),
    ).toEqual([{ slug: 'hypha', title: 'Hypha' }, { slug: 'x' }]);
    expect(readKnownSpaces({})).toEqual([]);
  });

  it('reads the scope lock flag', () => {
    expect(readScopeLocked({ scopeLocked: true })).toBe(true);
    expect(readScopeLocked({ scopeLocked: false })).toBe(false);
    expect(readScopeLocked({})).toBe(false);
    expect(readScopeLocked(undefined)).toBe(false);
  });
});
