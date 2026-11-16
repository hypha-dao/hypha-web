// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DealCard } from '../../components/deal-card';
import { KanbanBoard } from '../../components/kanban-board';

vi.mock('@hypha-platform/core/client', () => ({
  effectiveSuccessRate: () => 50,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: (n: number) => String(n) }),
}));

const deal = {
  id: 7,
  title: 'Deal seven',
  priority: 'medium',
  currency: '$',
  value: 100,
  pipelineStatus: 'lead',
  blocked: false,
} as never;

const stages = [{ slug: 'lead', name: 'Lead' }] as never;

afterEach(cleanup);

describe('DealCard readOnly', () => {
  it('default: a draggable button that reports its click', () => {
    const onClick = vi.fn();
    const { container } = render(<DealCard deal={deal} onClick={onClick} />);
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('draggable')).toBe('true');
    fireEvent.click(button as HTMLElement);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button?.className).toContain('craft-card-interactive');
  });

  it('readOnly: a plain element, no drag, no click, no interactive styling', () => {
    const onClick = vi.fn();
    const { container, getByText } = render(
      <DealCard deal={deal} onClick={onClick} readOnly />,
    );
    expect(container.querySelector('button')).toBeNull();
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('draggable')).toBeNull();
    expect(root.className).not.toContain('craft-card-interactive');
    expect(getByText('Deal seven')).toBeTruthy();
    fireEvent.click(root);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('KanbanBoard readOnly', () => {
  const drop = (target: Element) =>
    fireEvent.drop(target, {
      dataTransfer: {
        getData: (type: string) =>
          type === 'application/x-hypha-deal-id' ? '7' : '',
      },
    });

  it('default: dropping a deal on a column moves it', () => {
    const onMove = vi.fn();
    const { container } = render(
      <KanbanBoard deals={[deal]} stages={stages} onMoveStatus={onMove} />,
    );
    drop(container.querySelector('[data-pipeline-card-stack]')!.parentElement!);
    expect(onMove).toHaveBeenCalledWith(7, 'lead');
  });

  it('readOnly: no drop target, cards inert', () => {
    const onMove = vi.fn();
    const onClick = vi.fn();
    const { container } = render(
      <KanbanBoard
        deals={[deal]}
        stages={stages}
        onMoveStatus={onMove}
        onDealClick={onClick}
        readOnly
      />,
    );
    drop(container.querySelector('[data-pipeline-card-stack]')!.parentElement!);
    expect(onMove).not.toHaveBeenCalled();
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('[draggable]')).toBeNull();
  });
});
