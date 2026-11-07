import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@hypha-platform/ui', async () => {
  const actual = await vi.importActual<typeof import('@hypha-platform/ui')>(
    '@hypha-platform/ui',
  );
  return {
    ...actual,
    Dialog: ({
      children,
      open,
    }: {
      children?: React.ReactNode;
      open?: boolean;
    }) => (open ? <div>{children}</div> : null),
    DialogContent: ({
      children,
      className,
    }: {
      children?: React.ReactNode;
      className?: string;
    }) => <div className={className}>{children}</div>,
    DialogTitle: ({ children }: { children?: React.ReactNode }) => (
      <h2>{children}</h2>
    ),
  };
});

import { EditQuestMilestonesModal } from '../../components/quest-section-edit-modals';

describe('EditQuestMilestonesModal chrome', () => {
  it('says Add milestone and hides the hover hint when there are no rows', () => {
    const html = renderToStaticMarkup(
      <EditQuestMilestonesModal
        open
        onOpenChange={() => undefined}
        milestones={[]}
        onSave={() => undefined}
      />,
    );
    expect(html).toContain('Add milestone');
    expect(html).not.toContain('Add milestone at end');
    expect(html).not.toContain('Hover between two milestones');
    expect(html).toContain('data-testid="quest-edit-dialog-body"');
    expect(html).toContain('overflow-wrap:anywhere');
  });

  it('says Add milestone at end and shows the insert hint when rows exist', () => {
    const html = renderToStaticMarkup(
      <EditQuestMilestonesModal
        open
        onOpenChange={() => undefined}
        milestones={[
          {
            name: 'Run check',
            description: '',
            dueDate: '2026-11-20',
            ownerName: null,
            status: 'not_started',
          },
          {
            name: 'Review',
            description: '',
            dueDate: null,
            ownerName: null,
            status: 'not_started',
          },
        ]}
        onSave={() => undefined}
      />,
    );
    expect(html).toContain('Add milestone at end');
    expect(html).toContain('Add milestone here');
    expect(html).not.toContain('Hover between two milestones');
    expect(html).not.toContain('inserted after');
    expect(html).not.toContain('#3d3d8f');
    expect(html).not.toContain('#f3f3fa');
    expect(html).toContain('2026-11-20');
    expect(html).toContain('px-3 text-left');
    expect(html).toContain('>Unassigned<');
  });
});
