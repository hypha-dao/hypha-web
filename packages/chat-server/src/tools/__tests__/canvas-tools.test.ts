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

  it('resolves a loose numbered paraphrase to the known space carrying that number', () => {
    const numbered = [
      { slug: 'ger-de-bot-031', title: 'Ger de bot 031' },
      { slug: 'ger-test-video-032' },
      { slug: 'bot-ger-test-030', title: 'BOT Ger Test 030' },
    ];
    // "test 031" would otherwise be minted into the dead slug "test031".
    expect(resolveScopeTarget('test 031', numbered)).toEqual({
      slug: 'ger-de-bot-031',
      title: 'Ger de bot 031',
    });
    expect(resolveScopeTarget('the 030 one', numbered)?.slug).toBe(
      'bot-ger-test-030',
    );
    // Leading-zero-insensitive, but not so loose it matches "032".
    expect(resolveScopeTarget('31', numbered)?.slug).toBe('ger-de-bot-031');
  });

  it('does not digit-match when two known spaces share the number', () => {
    const ambiguous = [
      { slug: 'alpha-01', title: 'Alpha 01' },
      { slug: 'beta-01', title: 'Beta 01' },
    ];
    // Ambiguous → falls through; "gamma 01" is not slug-shaped → null.
    expect(resolveScopeTarget('gamma 01', ambiguous)).toBeNull();
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

  it('slugifies a plausible typed name when there is no candidate list yet', async () => {
    const tool = createSetScopeTool([]);
    const result = await tool.execute({ space: 'BOT Ger Test 030' } as never);
    expect(result).toEqual({ ok: true, spaceSlug: 'bot-ger-test-030' });
  });

  it('errors (does not mint a slug) for an unresolvable name once candidates are known', async () => {
    const tool = createSetScopeTool([
      { slug: 'ger-de-bot-031', title: 'Ger de bot 031' },
      { slug: 'hypha', title: 'Hypha' },
    ]);
    const result = (await tool.execute({
      space: 'the marketing space',
    } as never)) as { ok: boolean; spaceSlug?: string };
    expect(result.ok).toBe(false);
    expect(result.spaceSlug).toBeUndefined();
  });

  it('resolves a loose numbered paraphrase against the candidate list', async () => {
    const tool = createSetScopeTool([
      { slug: 'ger-de-bot-031', title: 'Ger de bot 031' },
      { slug: 'hypha', title: 'Hypha' },
    ]);
    const result = await tool.execute({ space: 'the test 031 one' } as never);
    expect(result).toEqual({
      ok: true,
      spaceSlug: 'ger-de-bot-031',
      title: 'Ger de bot 031',
    });
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
