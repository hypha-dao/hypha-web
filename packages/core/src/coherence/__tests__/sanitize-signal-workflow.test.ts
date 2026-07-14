import { describe, expect, it } from 'vitest';
import {
  resolveDefaultBoard,
  resolveDefaultProgressStatus,
  resolveEffectiveBoard,
  sanitizeSignalWorkflowConfig,
} from '../signal-workflow';

describe('sanitizeSignalWorkflowConfig', () => {
  it('deduplicates status slugs before validation', () => {
    const sanitized = sanitizeSignalWorkflowConfig({
      statuses: [
        {
          slug: 'done',
          name: 'Done',
          color: 'success',
          category: 'done',
          position: 0,
        },
        {
          slug: 'new_status',
          name: 'New status',
          color: 'neutral',
          category: 'backlog',
          position: 1,
        },
        {
          slug: 'new_status',
          name: 'New status',
          color: 'neutral',
          category: 'backlog',
          position: 2,
        },
      ],
      boards: [
        {
          slug: 'general',
          name: 'General',
          color: 'neutral',
          position: 0,
        },
      ],
    });

    expect(sanitized.statuses.map((status) => status.slug)).toEqual([
      'done',
      'new_status',
      'new_status_2',
    ]);
  });

  it('fills empty status names', () => {
    const sanitized = sanitizeSignalWorkflowConfig({
      statuses: [
        {
          slug: 'done',
          name: '',
          color: 'success',
          category: 'done',
          position: 0,
        },
      ],
      boards: [
        {
          slug: 'general',
          name: 'General',
          color: 'neutral',
          position: 0,
        },
      ],
    });

    expect(sanitized.statuses[0]?.name).toBe('Status 1');
  });
});

describe('resolveDefaultProgressStatus', () => {
  it('uses the first backlog-category status when backlog slug was renamed', () => {
    const slug = resolveDefaultProgressStatus({
      statuses: [
        {
          slug: 'todo',
          name: 'To do',
          color: 'accent',
          category: 'backlog',
          position: 0,
        },
        {
          slug: 'in_progress',
          name: 'In progress',
          color: 'warn',
          category: 'active',
          position: 1,
        },
      ],
      boards: [
        {
          slug: 'general',
          name: 'General',
          color: 'neutral',
          position: 0,
        },
      ],
    });

    expect(slug).toBe('todo');
  });
});

describe('resolveDefaultBoard', () => {
  const workflow = {
    statuses: [],
    boards: [
      { slug: 'product', name: 'Product', color: 'accent', position: 1 },
      { slug: 'general', name: 'General', color: 'neutral', position: 0 },
    ],
  };

  it('prefers the general board when present', () => {
    expect(resolveDefaultBoard(workflow)).toBe('general');
  });

  it('falls back to the first active board by position', () => {
    expect(
      resolveDefaultBoard({
        statuses: [],
        boards: [
          { slug: 'product', name: 'Product', color: 'accent', position: 0 },
        ],
      }),
    ).toBe('product');
  });
});

describe('resolveEffectiveBoard', () => {
  const workflow = {
    statuses: [],
    boards: [
      { slug: 'general', name: 'General', color: 'neutral', position: 0 },
      { slug: 'product', name: 'Product', color: 'accent', position: 1 },
    ],
  };

  it('maps null boards to general', () => {
    expect(resolveEffectiveBoard(null, workflow)).toBe('general');
  });

  it('maps unknown boards to general', () => {
    expect(resolveEffectiveBoard('missing', workflow)).toBe('general');
  });
});
