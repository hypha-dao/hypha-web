// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QuestUpdateRecord } from '@hypha-platform/core/client';
import { QuestUpdateCard } from '../quest-update-card';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const labels: Record<string, string> = {
      'updates.before': 'Before',
      'updates.after': 'After',
      'updates.showChanges': 'Show changes',
      'updates.hideChanges': 'Hide changes',
    };
    return labels[key] ?? key;
  },
}));

function update(
  partial: Partial<QuestUpdateRecord> & Pick<QuestUpdateRecord, 'id' | 'text'>,
): QuestUpdateRecord {
  return {
    questId: 1,
    authorPersonId: 7,
    authorName: 'Ada Lovelace',
    authorAvatarUrl: null,
    kind: 'post',
    viaAgent: false,
    milestoneOrder: null,
    milestoneLabel: null,
    links: [],
    change: null,
    createdAt: '2026-11-09T15:04:00.000Z',
    ...partial,
  };
}

class LoadedImage {
  complete = true;
  naturalWidth = 8;
  private currentSrc = '';
  get src() {
    return this.currentSrc;
  }
  set src(value: string) {
    this.currentSrc = value;
  }
  addEventListener() {}
  removeEventListener() {}
}

describe('quest update card', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('uses one card for creation, activation, and edits', () => {
    render(
      <div>
        <QuestUpdateCard
          update={update({ id: 1, text: 'created the quest' })}
        />
        <QuestUpdateCard
          update={update({
            id: 2,
            text: 'Quest proposal accepted — Quest is now Active.',
          })}
        />
        <QuestUpdateCard
          update={update({
            id: 3,
            kind: 'edit_event',
            text: 'Updated Goal.',
            change: {
              entity: 'quest',
              field: 'goal',
              action: 'updated',
              format: 'text',
              before: 'Old goal',
              after: 'New goal',
            },
          })}
        />
      </div>,
    );

    const cards = screen.getAllByTestId('quest-update-card');
    expect(cards).toHaveLength(3);
    expect(screen.queryByTestId('quest-update-edit-event')).toBeNull();
    for (const card of cards) {
      expect(
        card.querySelector('[data-testid="quest-update-avatar"]'),
      ).toBeTruthy();
      expect(
        card.querySelector('.text-\\[13px\\].font-semibold')?.className,
      ).toContain('text-[13px]');
    }
    expect(screen.getByText('created the quest')).toBeTruthy();
    expect(
      screen.getByText('Quest proposal accepted — Quest is now Active.'),
    ).toBeTruthy();
    expect(screen.getByText('Updated Goal.')).toBeTruthy();
    expect(screen.queryByText('Before')).toBeNull();
    expect(screen.queryByText('New goal')).toBeNull();
    const toggle = screen.getByTestId('quest-update-change-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Before')).toBeTruthy();
    expect(screen.getByText('New goal')).toBeTruthy();
  });

  it('renders a goal before block with the same markdown as after', () => {
    render(
      <QuestUpdateCard
        update={update({
          id: 6,
          kind: 'edit_event',
          text: 'Updated Goal.',
          change: {
            entity: 'quest',
            field: 'goal',
            action: 'updated',
            format: 'text',
            before: 'Keep \\[QA\\] and *draft*',
            after: 'Ship **live** today',
          },
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('quest-update-change-toggle'));
    const before = screen.getByTestId('quest-update-before');
    const after = screen.getByTestId('quest-update-after');
    expect(before.querySelector('p')?.className).toBe(
      after.querySelector('p')?.className,
    );
    expect(before.querySelector('div')?.className).toBe(
      after.querySelector('div')?.className,
    );
    expect(before.querySelector('div')?.className).toContain('leading-relaxed');
    expect(before.querySelector('div')?.className).toContain('text-foreground');
    expect(before.className).not.toContain('text-neutral-11');
    expect(before.textContent).toContain('Keep [QA]');
    expect(before.textContent).not.toContain('\\');
    expect(before.querySelector('em')?.textContent).toBe('draft');
    expect(after.querySelector('strong')?.textContent).toBe('live');
  });

  it('still shows a link stored on an existing update', () => {
    render(
      <QuestUpdateCard
        update={update({
          id: 7,
          text: 'Notes',
          links: [
            {
              label: 'Checklist',
              url: 'https://example.com/notes',
              kind: 'link',
            },
          ],
        })}
      />,
    );
    const link = screen.getByRole('link', { name: /Checklist/ });
    expect(link.getAttribute('href')).toBe('https://example.com/notes');
  });

  it('shows the profile picture and the user icon fallback', () => {
    vi.stubGlobal('Image', LoadedImage);
    const { rerender } = render(
      <QuestUpdateCard
        update={update({
          id: 1,
          text: 'Posted',
          authorAvatarUrl: 'https://example.com/ada.png',
        })}
      />,
    );
    expect(
      screen
        .getByTestId('quest-update-avatar')
        .querySelector('img')
        ?.getAttribute('src'),
    ).toBe('https://example.com/ada.png');

    rerender(
      <QuestUpdateCard
        update={update({ id: 1, text: 'Posted', authorAvatarUrl: null })}
      />,
    );
    const avatar = screen.getByTestId('quest-update-avatar');
    expect(avatar.querySelector('img')).toBeNull();
    expect(avatar.querySelector('svg')).toBeTruthy();
  });

  it('collapses long change text until it is expanded', () => {
    const ending = 'UNIQUE_END_TOKEN';
    render(
      <QuestUpdateCard
        update={update({
          id: 4,
          kind: 'edit_event',
          text: 'Updated Goal.',
          change: {
            entity: 'quest',
            field: 'goal',
            action: 'updated',
            format: 'text',
            before: 'Short',
            after: `${'word '.repeat(80)}${ending}`,
          },
        })}
      />,
    );
    expect(screen.queryByText(new RegExp(ending))).toBeNull();
    const toggle = screen.getByTestId('quest-update-change-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(screen.getByText(new RegExp(ending))).toBeTruthy();
    const panel = screen.getByTestId('quest-update-change');
    expect(panel.className).toContain('max-h-60');
    expect(panel.className).toContain('overflow-y-auto');
  });

  it('keeps the summary when no change data was stored', () => {
    render(
      <QuestUpdateCard
        update={update({
          id: 5,
          kind: 'edit_event',
          text: 'Updated Scope.',
          change: null,
        })}
      />,
    );
    expect(screen.getByText('Updated Scope.')).toBeTruthy();
    expect(screen.queryByTestId('quest-update-change')).toBeNull();
  });
});
