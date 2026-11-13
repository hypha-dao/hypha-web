// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatQuestCalendarDate } from '@hypha-platform/core/client';
import { EditQuestTargetDateModal } from '../quest-section-edit-modals';

const MONTHS: Record<string, string> = {
  January: '01',
  February: '02',
  March: '03',
  April: '04',
  May: '05',
  June: '06',
  July: '07',
  August: '08',
  September: '09',
  October: '10',
  November: '11',
  December: '12',
};

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

function storedFromDayLabel(label: string): string {
  const match = label.match(/([A-Z][a-z]+) (\d{1,2})(?:st|nd|rd|th), (\d{4})/);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new Error(`unparsed day label: ${label}`);
  }
  const month = MONTHS[match[1]];
  if (!month) throw new Error(`unknown month: ${match[1]}`);
  return `${match[3]}-${month}-${match[2].padStart(2, '0')}`;
}

afterEach(() => {
  cleanup();
});

describe('quest target date picker', () => {
  it('opens the calendar above the dialog and saves the formatted day', () => {
    installPointerCapture();
    const onSave = vi.fn();
    render(
      <EditQuestTargetDateModal
        open
        onOpenChange={() => undefined}
        value={null}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '20 November 2026' }));
    const popover = document.querySelector('[data-quest-date-popover]');
    expect(popover).toBeTruthy();
    expect(popover?.className).toContain('z-[200]');
    expect(popover?.className).toContain('pointer-events-auto');

    const day = popover?.querySelector('button.rdp-day_button:not([disabled])');
    expect(day).toBeInstanceOf(HTMLButtonElement);
    const stored = storedFromDayLabel(day?.getAttribute('aria-label') ?? '');
    fireEvent.click(day as HTMLButtonElement);

    expect(
      screen.getByRole('button', { name: formatQuestCalendarDate(stored) }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(stored);
  });
});
