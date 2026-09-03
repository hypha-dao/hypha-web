import { describe, expect, it, vi } from 'vitest';

import { createWidgetRegistry } from '../widget-registry';
import { fakeWidget } from './helpers';

describe('createWidgetRegistry', () => {
  it('registers and resolves widgets by id', () => {
    const registry = createWidgetRegistry();
    const signals = fakeWidget('signals');
    registry.register(signals);

    expect(registry.get('signals')).toBe(signals);
    expect(registry.has('signals')).toBe(true);
    expect(registry.get('missing')).toBeUndefined();
    expect(registry.has('missing')).toBe(false);
  });

  it('lists in registration order', () => {
    const registry = createWidgetRegistry();
    registry.register(fakeWidget('a'));
    registry.register(fakeWidget('b'));
    registry.register(fakeWidget('c'));

    expect(registry.list().map((d) => d.id)).toEqual(['a', 'b', 'c']);
  });

  it('warns and overwrites on duplicate id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const registry = createWidgetRegistry();
    const first = fakeWidget('signals');
    const second = fakeWidget('signals');

    registry.register(first);
    registry.register(second);

    expect(warn).toHaveBeenCalledOnce();
    expect(registry.get('signals')).toBe(second);
    expect(registry.list()).toHaveLength(1);
    warn.mockRestore();
  });

  it('builds a prompt catalogue from describeForModel', () => {
    const registry = createWidgetRegistry();
    expect(registry.catalogueForPrompt()).toBe(
      'No canvas widgets are available.',
    );

    registry.register(fakeWidget('signals'));
    registry.register(fakeWidget('treasury'));
    expect(registry.catalogueForPrompt()).toBe(
      '- signals: shows signals\n- treasury: shows treasury',
    );
  });
});
