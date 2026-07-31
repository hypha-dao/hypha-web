import { describe, expect, it } from 'vitest';
import {
  SPACE_SECTION_NAV_GROUP,
  buildSpaceSectionNavItems,
  type SpaceSectionNavKey,
} from '../space-section-nav';

const base = {
  lang: 'en',
  spaceSlug: 'hypha',
  pathname: '/en/dho/hypha/overview',
};

describe('buildSpaceSectionNavItems', () => {
  it('includes primary items and default more items', () => {
    const items = buildSpaceSectionNavItems(base);
    const keys = items.map((i) => i.key);
    expect(keys).toEqual([
      'overview',
      'agreements',
      'members',
      'treasury',
      'calendar',
      'coherence',
      'rewards',
      'banking',
      'ecosystem-navigation',
    ]);
    expect(items.every((i) => i.group === SPACE_SECTION_NAV_GROUP[i.key])).toBe(
      true,
    );
    expect(items.find((i) => i.key === 'overview')?.active).toBe(true);
    expect(items.filter((i) => i.active)).toHaveLength(1);
  });

  it('omits gated items when flags are false', () => {
    const items = buildSpaceSectionNavItems({
      ...base,
      coherenceEnabled: false,
      bankingEnabled: false,
      memoryEnabled: false,
      pipelineEnabled: false,
      energyEnabled: false,
    });
    const keys = items.map((i) => i.key);
    expect(keys).not.toContain('coherence');
    expect(keys).not.toContain('banking');
    expect(keys).not.toContain('memory');
    expect(keys).not.toContain('pipeline');
    expect(keys).not.toContain('energy');
  });

  it.each([
    ['pipeline', { pipelineEnabled: true }],
    ['energy', { energyEnabled: true }],
    ['memory', { memoryEnabled: true }],
  ] as const)('includes %s when enabled', (key, flags) => {
    const items = buildSpaceSectionNavItems({ ...base, ...flags });
    expect(items.some((i) => i.key === key)).toBe(true);
  });

  it('marks the matching pathname key active', () => {
    const keys: SpaceSectionNavKey[] = [
      'overview',
      'agreements',
      'members',
      'treasury',
      'calendar',
      'coherence',
      'pipeline',
      'energy',
      'rewards',
      'memory',
      'banking',
      'ecosystem-navigation',
    ];
    for (const key of keys) {
      const items = buildSpaceSectionNavItems({
        ...base,
        pathname: `/en/dho/hypha/${key}/extra`,
        pipelineEnabled: true,
        energyEnabled: true,
        memoryEnabled: true,
      });
      const active = items.filter((i) => i.active);
      expect(active).toHaveLength(1);
      expect(active[0]?.key).toBe(key);
      expect(active[0]?.href).toBe(`/en/dho/hypha/${key}`);
    }
  });
});
