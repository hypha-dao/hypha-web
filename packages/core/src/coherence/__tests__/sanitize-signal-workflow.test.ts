import { describe, expect, it } from 'vitest';
import { sanitizeSignalWorkflowConfig } from '../signal-workflow';

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
