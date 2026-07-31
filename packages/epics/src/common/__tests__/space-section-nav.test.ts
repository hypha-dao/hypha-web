import { describe, expect, it } from 'vitest';
import {
  SPACE_SECTION_NAV_GROUP,
  buildSpaceSectionNavItems,
  partitionSpaceSectionNavForTabs,
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
      'coherence',
      'agreements',
      'treasury',
      'calendar',
      'members',
      'rewards',
      'ecosystem-navigation',
    ]);
    expect(items.every((i) => i.group === SPACE_SECTION_NAV_GROUP[i.key])).toBe(
      true,
    );
    expect(SPACE_SECTION_NAV_GROUP.coherence).toBe('primary');
    expect(SPACE_SECTION_NAV_GROUP.members).toBe('more');
    expect(items.find((i) => i.key === 'overview')?.active).toBe(true);
    expect(items.filter((i) => i.active)).toHaveLength(1);
  });

  it('omits gated items when flags are false', () => {
    const items = buildSpaceSectionNavItems({
      ...base,
      coherenceEnabled: false,
      memoryEnabled: false,
      pipelineEnabled: false,
      energyEnabled: false,
    });
    const keys = items.map((i) => i.key);
    expect(keys).not.toContain('coherence');
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

  it('treats /banking as treasury for active state', () => {
    const items = buildSpaceSectionNavItems({
      ...base,
      pathname: '/en/dho/hypha/banking',
    });
    expect(items.map((i) => i.key)).not.toContain('banking');
    expect(items.find((i) => i.key === 'treasury')?.active).toBe(true);
    expect(items.filter((i) => i.active)).toHaveLength(1);
  });
});

describe('partitionSpaceSectionNavForTabs', () => {
  it('keeps default primary/more when active is a primary key', () => {
    const items = buildSpaceSectionNavItems(base);
    const { primary, more } = partitionSpaceSectionNavForTabs(items);
    expect(primary.map((i) => i.key)).toEqual([
      'overview',
      'coherence',
      'agreements',
      'treasury',
      'calendar',
    ]);
    expect(more.map((i) => i.key)).toEqual([
      'members',
      'rewards',
      'ecosystem-navigation',
    ]);
  });

  it('promotes an active More item into the last primary slot', () => {
    const items = buildSpaceSectionNavItems({
      ...base,
      pathname: '/en/dho/hypha/ecosystem-navigation',
      memoryEnabled: true,
    });
    const { primary, more } = partitionSpaceSectionNavForTabs(items);

    expect(primary.map((i) => i.key)).toEqual([
      'overview',
      'coherence',
      'agreements',
      'treasury',
      'ecosystem-navigation',
    ]);
    expect(primary.at(-1)?.active).toBe(true);
    expect(more.map((i) => i.key)).toEqual([
      'calendar',
      'members',
      'rewards',
      'memory',
    ]);
    expect(more.every((i) => !i.active)).toBe(true);
  });

  it('restores default grouping when navigating back to a primary key', () => {
    const onEcosystem = partitionSpaceSectionNavForTabs(
      buildSpaceSectionNavItems({
        ...base,
        pathname: '/en/dho/hypha/ecosystem-navigation',
      }),
    );
    expect(onEcosystem.primary.map((i) => i.key)).toContain(
      'ecosystem-navigation',
    );
    expect(onEcosystem.more.map((i) => i.key)).toContain('calendar');

    const onOverview = partitionSpaceSectionNavForTabs(
      buildSpaceSectionNavItems(base),
    );
    expect(onOverview.primary.map((i) => i.key)).toEqual([
      'overview',
      'coherence',
      'agreements',
      'treasury',
      'calendar',
    ]);
    expect(onOverview.more.map((i) => i.key)).toContain('ecosystem-navigation');
    expect(onOverview.more.map((i) => i.key)).not.toContain('calendar');
  });

  it('promotes gated More items when they are active and enabled', () => {
    const { primary, more } = partitionSpaceSectionNavForTabs(
      buildSpaceSectionNavItems({
        ...base,
        pathname: '/en/dho/hypha/pipeline',
        pipelineEnabled: true,
      }),
    );
    expect(primary.at(-1)?.key).toBe('pipeline');
    expect(primary.at(-1)?.active).toBe(true);
    expect(more.map((i) => i.key)).toContain('calendar');
    expect(more.map((i) => i.key)).not.toContain('pipeline');
  });

  it('does not promote gated items that are omitted when disabled', () => {
    const items = buildSpaceSectionNavItems({
      ...base,
      pathname: '/en/dho/hypha/overview',
      pipelineEnabled: false,
      energyEnabled: false,
      memoryEnabled: false,
    });
    const { primary, more } = partitionSpaceSectionNavForTabs(items);
    expect([...primary, ...more].map((i) => i.key)).not.toContain('pipeline');
    expect([...primary, ...more].map((i) => i.key)).not.toContain('energy');
    expect([...primary, ...more].map((i) => i.key)).not.toContain('memory');
  });
});
