import { describe, expect, it } from 'vitest';

import { parseDrillEvent } from '../drill';

describe('parseDrillEvent (#2486 M9)', () => {
  it('parses a well-formed row drill event', () => {
    expect(
      parseDrillEvent({
        type: 'drill',
        sourceWidgetId: 'signals',
        descriptor: {
          itemKind: 'signal',
          label: 'Treasury gap',
          scope: 'item',
          itemSlug: 'treasury-gap',
          itemId: '42',
        },
      }),
    ).toEqual({
      sourceWidgetId: 'signals',
      descriptor: {
        itemKind: 'signal',
        label: 'Treasury gap',
        scope: 'item',
        itemSlug: 'treasury-gap',
        itemId: '42',
      },
    });
  });

  it('defaults scope to "item" and omits absent id/slug', () => {
    const parsed = parseDrillEvent({
      type: 'drill',
      sourceWidgetId: 'agreements',
      descriptor: { itemKind: 'agreement', label: 'Q3 Budget' },
    });
    expect(parsed).toEqual({
      sourceWidgetId: 'agreements',
      descriptor: { itemKind: 'agreement', label: 'Q3 Budget', scope: 'item' },
    });
  });

  it('keeps an explicit widget scope', () => {
    expect(
      parseDrillEvent({
        type: 'drill',
        sourceWidgetId: 'signals',
        descriptor: { itemKind: 'signals', label: 'Signals', scope: 'widget' },
      })?.descriptor.scope,
    ).toBe('widget');
  });

  it('returns null for a non-drill event', () => {
    expect(parseDrillEvent({ type: 'click', foo: 1 })).toBeNull();
  });

  it('returns null when sourceWidgetId or descriptor fields are missing', () => {
    expect(
      parseDrillEvent({
        type: 'drill',
        descriptor: { itemKind: 'x', label: 'y' },
      }),
    ).toBeNull();
    expect(
      parseDrillEvent({ type: 'drill', sourceWidgetId: 'signals' }),
    ).toBeNull();
    expect(
      parseDrillEvent({
        type: 'drill',
        sourceWidgetId: 'signals',
        descriptor: { itemKind: 'signal' },
      }),
    ).toBeNull();
    expect(
      parseDrillEvent({
        type: 'drill',
        sourceWidgetId: '  ',
        descriptor: { itemKind: 'signal', label: 'z' },
      }),
    ).toBeNull();
  });
});
