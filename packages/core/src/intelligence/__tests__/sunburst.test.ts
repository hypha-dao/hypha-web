import { describe, expect, it } from 'vitest';
import {
  buildIntelligenceSunburstTree,
  categorizeSignal,
  SIGNAL_SUNBURST_CATEGORY_COLORS,
} from '../sunburst';

describe('categorizeSignal', () => {
  it('maps treasury tags to financial', () => {
    expect(
      categorizeSignal({
        slug: 'coh-1',
        title: 'Runway watch',
        tags: ['Treasury', 'Fundraising'],
      }),
    ).toBe('financial');
  });

  it('maps governance language to governance', () => {
    expect(
      categorizeSignal({
        slug: 'coh-2',
        title: 'Voting participation dropped',
        type: 'Proposal',
      }),
    ).toBe('governance');
  });

  it('falls back to uncategorized when nothing matches', () => {
    expect(
      categorizeSignal({
        slug: 'coh-3',
        title: 'Untitled note',
      }),
    ).toBe('uncategorized');
  });
});

describe('buildIntelligenceSunburstTree', () => {
  it('nests files under artifacts under categorized signals', () => {
    const tree = buildIntelligenceSunburstTree({
      rootName: 'Demo',
      signals: [
        {
          slug: 'coh-gov',
          title: 'Governance gap',
          tags: ['Governance'],
        },
      ],
      artifacts: [
        {
          id: 'insight-1',
          title: 'Board insight',
          linked_signals: ['coh-gov'],
        },
      ],
      files: [
        {
          id: 44,
          title: 'Charter.pdf',
          linked_artifact_id: 'insight-1',
          slug: 'charter',
        },
      ],
    });

    expect(tree.name).toBe('Demo');
    const category = tree.children?.[0];
    expect(category?.kind).toBe('category');
    expect(category?.categoryId).toBe('governance');
    expect(category?.color).toBe(SIGNAL_SUNBURST_CATEGORY_COLORS.governance);
    const signal = category?.children?.[0];
    expect(signal?.kind).toBe('signal');
    expect(signal?.name).toBe('Governance gap');
    const artifact = signal?.children?.[0];
    expect(artifact?.kind).toBe('artifact');
    expect(artifact?.name).toBe('Board insight');
    expect(artifact?.children?.[0]).toMatchObject({
      kind: 'file',
      name: 'Charter.pdf',
    });
  });

  it('places unlinked artifacts under uncategorized', () => {
    const tree = buildIntelligenceSunburstTree({
      signals: [],
      artifacts: [{ id: 'orphan', title: 'Loose insight', linked_signals: [] }],
    });
    const category = tree.children?.[0];
    expect(category?.categoryId).toBe('uncategorized');
    expect(category?.children?.[0]).toMatchObject({
      kind: 'artifact',
      artifactId: 'orphan',
    });
  });

  it('omits empty categories', () => {
    const tree = buildIntelligenceSunburstTree({
      signals: [{ slug: 'coh-net', title: 'Mesh health', tags: ['Network'] }],
      artifacts: [],
    });
    expect(tree.children?.map((child) => child.categoryId)).toEqual([
      'network',
    ]);
  });
});
