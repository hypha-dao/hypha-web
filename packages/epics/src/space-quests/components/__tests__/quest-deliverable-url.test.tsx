// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QUEST_DELIVERABLE_URL_CODE } from '@hypha-platform/core/client';
import { EditQuestDeliverablesModal } from '../quest-section-edit-modals';

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) =>
    key === 'deliverableUrl'
      ? 'Enter a link starting with http:// or https://'
      : key,
}));

afterEach(() => {
  cleanup();
});

describe('deliverable URL field', () => {
  it('keeps the modal open and shows the field error before submit', async () => {
    const onSave = vi.fn();
    render(
      <EditQuestDeliverablesModal
        open
        onOpenChange={() => undefined}
        deliverables={[]}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByTestId('deliverable-url-0'), {
      target: { value: 'ftp://files.example/spec' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Space Context editor/i), {
      target: { value: 'Spec' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByTestId('deliverable-url-error-0')).toBeTruthy();
    expect(screen.getByTestId('deliverable-url-error-0').textContent).toBe(
      'Enter a link starting with http:// or https://',
    );
    expect(
      screen.getByRole('heading', { name: 'Edit deliverables' }),
    ).toBeTruthy();
    expect(screen.queryByTestId('quest-action-error')).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('maps a server deliverable URL error onto the field and leaves the page banner unused', async () => {
    const onSave = vi.fn().mockResolvedValue({
      ok: false,
      code: QUEST_DELIVERABLE_URL_CODE,
      message: 'Enter a link starting with http:// or https://',
      path: ['deliverables', 0, 'url'],
    });
    render(
      <EditQuestDeliverablesModal
        open
        onOpenChange={() => undefined}
        deliverables={[{ name: 'Spec', url: 'https://example.com/spec' }]}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByTestId('deliverable-url-error-0')).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Edit deliverables' }),
    ).toBeTruthy();
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
