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

const menuKeys = ['overview', 'coherence', 'agreements', 'treasury'] as const;

describe('buildSpaceSectionNavItems', () => {
  it('keeps the menu to home, signals, agreements, and treasury', () => {
    const items = buildSpaceSectionNavItems(base);
    expect(items.map((item) => item.key)).toEqual([...menuKeys]);
    expect(
      items.every((item) => item.group === SPACE_SECTION_NAV_GROUP[item.key]),
    ).toBe(true);
    expect(SPACE_SECTION_NAV_GROUP.memory).toBe('primary');
    expect(items.find((item) => item.key === 'overview')?.active).toBe(true);
    expect(items.filter((item) => item.active)).toHaveLength(1);
  });

  it('adds space memory when that section is on', () => {
    const items = buildSpaceSectionNavItems({
      ...base,
      memoryEnabled: true,
    });
    expect(items.map((item) => item.key)).toEqual([...menuKeys, 'memory']);
  });

  it('omits signals when coherence is off', () => {
    const items = buildSpaceSectionNavItems({
      ...base,
      coherenceEnabled: false,
    });
    expect(items.map((item) => item.key)).not.toContain('coherence');
  });

  it('keeps energy, calendar, members, rewards, ecosystem, and pipeline off the menu', () => {
    const items = buildSpaceSectionNavItems({
      ...base,
      pipelineEnabled: true,
      energyEnabled: true,
      memoryEnabled: true,
    });
    const keys = items.map((item) => item.key);
    expect(keys).not.toContain('pipeline');
    expect(keys).not.toContain('energy');
    expect(keys).not.toContain('calendar');
    expect(keys).not.toContain('members');
    expect(keys).not.toContain('rewards');
    expect(keys).not.toContain('ecosystem-navigation');
  });

  it('marks the matching menu pathname active', () => {
    const keys: SpaceSectionNavKey[] = [
      'overview',
      'agreements',
      'coherence',
      'treasury',
      'memory',
    ];
    for (const key of keys) {
      const items = buildSpaceSectionNavItems({
        ...base,
        pathname: `/en/dho/hypha/${key}/extra`,
        memoryEnabled: true,
      });
      const active = items.filter((item) => item.active);
      expect(active).toHaveLength(1);
      expect(active[0]?.key).toBe(key);
    }
  });

  it('keeps Home selected on screens that now live on the dashboard', () => {
    for (const key of [
      'calendar',
      'members',
      'rewards',
      'energy',
      'ecosystem-navigation',
      'pipeline',
    ]) {
      const items = buildSpaceSectionNavItems({
        ...base,
        pathname: `/en/dho/hypha/${key}`,
        pipelineEnabled: true,
        energyEnabled: true,
      });
      expect(items.find((item) => item.active)?.key).toBe('overview');
    }
  });

  it('treats /banking as treasury for active state', () => {
    const items = buildSpaceSectionNavItems({
      ...base,
      pathname: '/en/dho/hypha/banking',
    });
    expect(items.map((item) => item.key)).not.toContain('banking');
    expect(items.find((item) => item.key === 'treasury')?.active).toBe(true);
    expect(items.filter((item) => item.active)).toHaveLength(1);
  });
});

describe('partitionSpaceSectionNavForTabs', () => {
  it('puts the menu in the primary strip', () => {
    const { primary, more } = partitionSpaceSectionNavForTabs(
      buildSpaceSectionNavItems({ ...base, memoryEnabled: true }),
    );
    expect(primary.map((item) => item.key)).toEqual([...menuKeys, 'memory']);
    expect(more).toEqual([]);
  });

  it('keeps the same primary tabs on a dashboard screen', () => {
    const onCalendar = partitionSpaceSectionNavForTabs(
      buildSpaceSectionNavItems({
        ...base,
        pathname: '/en/dho/hypha/calendar',
      }),
    );
    const onOverview = partitionSpaceSectionNavForTabs(
      buildSpaceSectionNavItems(base),
    );
    expect(onCalendar.primary.map((item) => item.key)).toEqual(
      onOverview.primary.map((item) => item.key),
    );
    expect(onCalendar.primary.find((item) => item.active)?.key).toBe(
      'overview',
    );
    expect(onOverview.primary.find((item) => item.active)?.key).toBe(
      'overview',
    );
  });
});
