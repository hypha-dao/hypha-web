import { describe, expect, it, vi } from 'vitest';

import {
  EMPTY_CANVAS_STATE,
  extractCanvasIntents,
  extractNextActions,
  reduceCanvas,
  selectCanvasState,
} from '../use-canvas';
import type { CanvasState, ConversationMessage } from '../types';
import { fakeWidget, registryWith, requiresSpaceSlugSchema } from './helpers';

const registry = registryWith(
  fakeWidget('signals', requiresSpaceSlugSchema()),
  fakeWidget('treasury'),
);

function canvasMessage(
  id: string,
  widgets: unknown[],
  state = 'output-available',
): ConversationMessage {
  return {
    id,
    role: 'assistant',
    parts: [
      {
        type: 'tool-set_canvas',
        state,
        output: { ok: true, canvas: widgets },
      },
    ],
  };
}

describe('extractCanvasIntents', () => {
  it('reads widgetId/params/layoutHint and tolerates snake_case', () => {
    const intents = extractCanvasIntents({
      ok: true,
      canvas: [
        {
          widgetId: 'signals',
          params: { spaceSlug: 'hypha' },
          layoutHint: 'half',
        },
        { widget_id: 'treasury', params: {}, layout_hint: 'aside' },
      ],
    });
    expect(intents).toEqual([
      {
        widgetId: 'signals',
        params: { spaceSlug: 'hypha' },
        layoutHint: 'half',
        key: undefined,
      },
      { widgetId: 'treasury', params: {}, layoutHint: 'aside', key: undefined },
    ]);
  });

  it('falls back to the raw widgets input array', () => {
    const intents = extractCanvasIntents({
      widgets: [{ widget_id: 'signals', params: { spaceSlug: 'x' } }],
    });
    expect(intents).toHaveLength(1);
  });

  it('drops entries without a widget id and returns [] when ok is false', () => {
    expect(
      extractCanvasIntents({ ok: true, canvas: [{ params: {} }] }),
    ).toEqual([]);
    expect(
      extractCanvasIntents({ ok: false, canvas: [{ widgetId: 'x' }] }),
    ).toEqual([]);
  });
});

describe('extractNextActions', () => {
  it('normalises actions and fills a missing id', () => {
    const actions = extractNextActions({
      ok: true,
      actions: [
        { label: 'Show signals', prompt: 'show signals', emphasis: 'primary' },
        { id: 'health', label: 'Review stale signals', emphasis: 'guidance' },
        { label: 'no-op', emphasis: 'bogus' },
      ],
    });
    expect(actions).toEqual([
      {
        id: 'na-0',
        label: 'Show signals',
        prompt: 'show signals',
        href: undefined,
        emphasis: 'primary',
      },
      {
        id: 'health',
        label: 'Review stale signals',
        prompt: undefined,
        href: undefined,
        emphasis: 'guidance',
      },
      {
        id: 'na-2',
        label: 'no-op',
        prompt: undefined,
        href: undefined,
        emphasis: undefined,
      },
    ]);
  });

  it('drops actions with no label', () => {
    expect(
      extractNextActions({ ok: true, actions: [{ prompt: 'x' }] }),
    ).toEqual([]);
  });
});

describe('reduceCanvas', () => {
  it('replaces the whole set and dedupes by computed key', () => {
    const next = reduceCanvas(
      EMPTY_CANVAS_STATE,
      [
        { widgetId: 'signals', params: { spaceSlug: 'hypha' } },
        { widgetId: 'signals', params: { spaceSlug: 'hypha' } },
        { widgetId: 'treasury', params: {} },
      ],
      registry,
      'm1',
    );
    expect(next.widgets.map((w) => w.widgetId)).toEqual([
      'signals',
      'treasury',
    ]);
    expect(next.updatedFromMessageId).toBe('m1');
  });

  it('drops unknown widgets and invalid params, keeps the rest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const next = reduceCanvas(
      EMPTY_CANVAS_STATE,
      [
        { widgetId: 'ghost', params: {} },
        { widgetId: 'signals', params: {} }, // missing spaceSlug
        { widgetId: 'treasury', params: { web3SpaceId: 1 } },
      ],
      registry,
      'm2',
    );
    expect(next.widgets.map((w) => w.widgetId)).toEqual(['treasury']);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('keeps last-good when the new set is empty', () => {
    const good: CanvasState = {
      widgets: [{ widgetId: 'treasury', params: {}, key: 'treasury:{}' }],
      updatedFromMessageId: 'm1',
    };
    const next = reduceCanvas(
      good,
      [{ widgetId: 'ghost', params: {} }],
      registry,
      'm2',
    );
    expect(next).toBe(good);
  });

  it('honours an explicit dedupe key', () => {
    const next = reduceCanvas(
      EMPTY_CANVAS_STATE,
      [
        { widgetId: 'treasury', params: { a: 1 }, key: 'pinned' },
        { widgetId: 'treasury', params: { a: 2 }, key: 'pinned' },
      ],
      registry,
    );
    expect(next.widgets).toHaveLength(1);
    expect(next.widgets[0]?.params).toEqual({ a: 1 });
  });
});

describe('selectCanvasState', () => {
  it('replays every completed set_canvas oldest → newest (latest wins)', () => {
    const messages: ConversationMessage[] = [
      canvasMessage('m1', [
        { widgetId: 'signals', params: { spaceSlug: 'hypha' } },
      ]),
      canvasMessage('m2', [{ widgetId: 'treasury', params: {} }]),
    ];
    const state = selectCanvasState(messages, registry);
    expect(state.widgets.map((w) => w.widgetId)).toEqual(['treasury']);
    expect(state.updatedFromMessageId).toBe('m2');
  });

  it('ignores tool parts that are not yet complete', () => {
    const messages = [
      canvasMessage('m1', [{ widgetId: 'treasury', params: {} }]),
      canvasMessage(
        'm2',
        [{ widgetId: 'signals', params: { spaceSlug: 'x' } }],
        'input-available',
      ),
    ];
    const state = selectCanvasState(messages, registry);
    expect(state.widgets.map((w) => w.widgetId)).toEqual(['treasury']);
  });

  it('survives an errored/empty later turn (last-good)', () => {
    const messages = [
      canvasMessage('m1', [{ widgetId: 'treasury', params: {} }]),
      canvasMessage('m2', [{ widgetId: 'ghost', params: {} }]),
    ];
    const state = selectCanvasState(messages, registry);
    expect(state.widgets.map((w) => w.widgetId)).toEqual(['treasury']);
  });

  it('returns the empty state when there are no canvas calls', () => {
    expect(
      selectCanvasState([{ id: 'u', role: 'user', parts: [] }], registry),
    ).toEqual(EMPTY_CANVAS_STATE);
  });
});
