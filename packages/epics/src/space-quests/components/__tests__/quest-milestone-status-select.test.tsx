// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuestMilestoneStatusSelect } from '../quest-milestone-status-select';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const labels: Record<string, string> = {
      'milestones.status.not_started': 'Not started',
      'milestones.status.in_progress': 'In progress',
      'milestones.status.done': 'Done',
    };
    return labels[key] ?? key;
  },
}));

function installPointerCapture() {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => undefined;
  }
}

describe('quest milestone status select', () => {
  afterEach(() => {
    cleanup();
  });

  it('uses the design-system menu and keeps the status values', async () => {
    installPointerCapture();
    const onChange = vi.fn();
    render(
      <QuestMilestoneStatusSelect
        value="in_progress"
        ariaLabel="Status for Ship"
        testId="milestone-status-1"
        onChange={onChange}
      />,
    );

    expect(document.querySelector('select')).toBeNull();
    const trigger = screen.getByTestId('milestone-status-1');
    expect(trigger.className).toContain('px-3');
    expect(trigger.className).toContain('h-10');
    expect(trigger.getAttribute('aria-label')).toBe('Status for Ship');

    fireEvent.pointerDown(trigger, { button: 0, pointerId: 1 });
    fireEvent.click(trigger);

    expect(
      await screen.findByRole('option', { name: 'Not started' }),
    ).toBeTruthy();
    expect(screen.getByRole('option', { name: 'In progress' })).toBeTruthy();
    fireEvent.click(screen.getByRole('option', { name: 'Done' }));
    expect(onChange).toHaveBeenCalledWith('done');
  });
});
