// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  Coherence,
  SignalWorkflowConfig,
} from '@hypha-platform/core/client';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@hypha-platform/core/client', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../../core/src/coherence/signal-workflow')
  >('../../../../../core/src/coherence/signal-workflow');
  const types = await vi.importActual<
    typeof import('../../../../../core/src/coherence/coherence-types')
  >('../../../../../core/src/coherence/coherence-types');
  return {
    ...actual,
    ...types,
    usePersonById: ({ id }: { id: number }) => ({
      person: { name: `Person ${id}`, surname: '' },
    }),
  };
});
vi.mock('../../../people/components/person-avatar', () => ({
  PersonAvatar: () => null,
}));
vi.mock('../../components/signal-type-badge', () => ({
  SignalTypeBadge: ({ type }: { type: string }) => <span>{type}</span>,
}));

import { SignalSwimlanes } from '../../components/signal-swimlanes';
import { groupSignalsIntoLanes } from '../signal-swimlanes';

const workflow = {
  statuses: [],
  boards: [
    { slug: 'general', name: 'General', color: 'neutral', position: 0 },
    { slug: 'energy', name: 'Energy', color: 'accent', position: 1 },
  ],
} as SignalWorkflowConfig;

const signal = (
  id: number,
  board: string | null,
  type: string,
  creatorId: number,
) =>
  ({
    id,
    slug: `s${id}`,
    title: `Signal ${id}`,
    board,
    type,
    creatorId,
  } as unknown as Coherence);

const signals = [
  signal(1, 'energy', 'Risk', 7),
  signal(2, null, 'Need', 9),
  signal(3, 'energy', 'Need', 7),
];

const renderSignal = (item: Coherence) => (
  <div data-testid="row">{item.title}</div>
);

afterEach(cleanup);

describe('SignalSwimlanes', () => {
  it('renders one row per board with its signals and count', () => {
    const { getAllByTestId } = render(
      <SignalSwimlanes
        lanes={groupSignalsIntoLanes(signals, workflow, 'none')}
        columns="none"
        spaceSlug="space"
        renderSignal={renderSignal}
      />,
    );
    const lanes = getAllByTestId('signal-lane');
    expect(lanes.map((lane) => lane.dataset.board)).toEqual([
      'general',
      'energy',
    ]);
    expect(lanes[1]!.textContent).toContain('Signal 1');
    expect(lanes[1]!.textContent).toContain('Signal 3');
    expect(lanes[0]!.textContent).toContain('Signal 2');
  });

  it('labels creator columns with the person name', () => {
    const { getAllByTestId } = render(
      <SignalSwimlanes
        lanes={groupSignalsIntoLanes(signals, workflow, 'creator')}
        columns="creator"
        spaceSlug="space"
        renderSignal={renderSignal}
      />,
    );
    const energyColumns = getAllByTestId('signal-lane')[1]!.querySelectorAll(
      '[data-testid="signal-lane-column"]',
    );
    expect([...energyColumns].map((column) => column.textContent)).toEqual([
      expect.stringContaining('Person 7'),
      expect.stringContaining('Person 9'),
    ]);
  });

  it('is not draggable without a move handler', () => {
    const { container } = render(
      <SignalSwimlanes
        lanes={groupSignalsIntoLanes(signals, workflow, 'type')}
        columns="type"
        spaceSlug="space"
        renderSignal={renderSignal}
      />,
    );
    expect(container.querySelector('[draggable="true"]')).toBeNull();
  });

  it('moves a signal to the board it is dropped on', () => {
    const onMoveToBoard = vi.fn();
    const { getAllByTestId } = render(
      <SignalSwimlanes
        lanes={groupSignalsIntoLanes(signals, workflow, 'none')}
        columns="none"
        spaceSlug="space"
        renderSignal={renderSignal}
        onMoveToBoard={onMoveToBoard}
      />,
    );
    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? '',
      effectAllowed: 'move',
      dropEffect: 'move',
    };
    const [general, energy] = getAllByTestId('signal-lane');
    const card = general!.querySelector('[draggable="true"]')!;
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.drop(energy!, { dataTransfer });
    expect(onMoveToBoard).toHaveBeenCalledTimes(1);
    expect(onMoveToBoard.mock.calls[0]![0].id).toBe(2);
    expect(onMoveToBoard.mock.calls[0]![1]).toBe('energy');
  });
});
