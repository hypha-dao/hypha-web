import { describe, expect, it } from 'vitest';
import {
  buildIntelligenceSunburstTree,
  resolveSunburstBoard,
  SUNBURST_BOARD_PALETTE,
} from '../sunburst';

const BOARDS = [
  { slug: 'general', name: 'General', position: 0 },
  { slug: 'outreach', name: 'Outreach', position: 1 },
  { slug: 'product', name: 'Product', position: 2 },
];

describe('resolveSunburstBoard', () => {
  it('keeps a known active board', () => {
    expect(resolveSunburstBoard('product', BOARDS, 'general')).toBe('product');
  });

  it('falls back to the default board when missing or unknown', () => {
    expect(resolveSunburstBoard(null, BOARDS, 'general')).toBe('general');
    expect(resolveSunburstBoard('archived_lane', BOARDS, 'general')).toBe(
      'general',
    );
  });
});

describe('buildIntelligenceSunburstTree', () => {
  it('nests files under artifacts under board categories', () => {
    const tree = buildIntelligenceSunburstTree({
      rootName: 'Demo',
      defaultBoard: 'general',
      boards: BOARDS,
      signals: [
        {
          slug: 'coh-out',
          title: 'Partner intro',
          board: 'outreach',
        },
      ],
      artifacts: [
        {
          id: 'insight-1',
          title: 'Board insight',
          linked_signals: ['coh-out'],
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
    expect(category?.categoryId).toBe('outreach');
    expect(category?.name).toBe('Outreach');
    expect(category?.color).toBe(SUNBURST_BOARD_PALETTE[1]);
    const signal = category?.children?.[0];
    expect(signal?.kind).toBe('signal');
    expect(signal?.name).toBe('Partner intro');
    const artifact = signal?.children?.[0];
    expect(artifact?.kind).toBe('artifact');
    expect(artifact?.name).toBe('Board insight');
    expect(artifact?.children?.[0]).toMatchObject({
      kind: 'file',
      name: 'Charter.pdf',
    });
  });

  it('does not treat artifacts linked to another board as unlinked', () => {
    const tree = buildIntelligenceSunburstTree({
      defaultBoard: 'general',
      boards: BOARDS,
      signals: [{ slug: 'coh-out', title: 'Partner intro', board: 'outreach' }],
      artifacts: [
        {
          id: 'insight-1',
          title: 'Board insight',
          linked_signals: ['coh-out'],
        },
        { id: 'orphan', title: 'Loose insight', linked_signals: [] },
      ],
    });
    const byBoard = Object.fromEntries(
      (tree.children ?? []).map((child) => [child.categoryId, child]),
    );
    expect(byBoard.outreach?.children?.[0]).toMatchObject({
      kind: 'signal',
      name: 'Partner intro',
    });
    expect(byBoard.outreach?.children?.[0]?.children?.[0]).toMatchObject({
      kind: 'artifact',
      artifactId: 'insight-1',
    });
    expect(byBoard.general?.children?.map((child) => child.artifactId)).toEqual(
      ['orphan'],
    );
  });

  it('places unlinked artifacts under the default board', () => {
    const tree = buildIntelligenceSunburstTree({
      defaultBoard: 'general',
      boards: BOARDS,
      signals: [],
      artifacts: [{ id: 'orphan', title: 'Loose insight', linked_signals: [] }],
    });
    const category = tree.children?.[0];
    expect(category?.categoryId).toBe('general');
    expect(category?.name).toBe('General');
    expect(category?.children?.[0]).toMatchObject({
      kind: 'artifact',
      artifactId: 'orphan',
    });
  });

  it('omits empty boards', () => {
    const tree = buildIntelligenceSunburstTree({
      defaultBoard: 'general',
      boards: BOARDS,
      signals: [{ slug: 'coh-p', title: 'Ship it', board: 'product' }],
      artifacts: [],
    });
    expect(tree.children?.map((child) => child.categoryId)).toEqual([
      'product',
    ]);
  });
});
