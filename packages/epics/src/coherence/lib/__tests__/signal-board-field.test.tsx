// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SIGNAL_WORKFLOW,
  type SignalWorkflowConfig,
} from '@hypha-platform/core/client';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { SignalBoardField } from '../../components/signal-board-field';

function Harness(props: React.ComponentProps<typeof SignalBoardField>) {
  const form = useForm({ defaultValues: { board: null } });
  return (
    <FormProvider {...form}>
      <SignalBoardField {...props} />
    </FormProvider>
  );
}

const twoBoards: SignalWorkflowConfig = {
  ...DEFAULT_SIGNAL_WORKFLOW,
  boards: [
    { slug: 'general', name: 'General', color: 'neutral', position: 0 },
    { slug: 'energy', name: 'Energy', color: 'accent', position: 1 },
  ],
};

afterEach(cleanup);

describe('SignalBoardField', () => {
  it('renders nothing for a single-board space', () => {
    const { container } = render(
      <Harness workflow={DEFAULT_SIGNAL_WORKFLOW} />,
    );
    expect(container.textContent).toBe('');
  });

  it('renders the picker for a space with two boards', () => {
    const { getByText } = render(<Harness workflow={twoBoards} />);
    expect(getByText('signalFormBoard')).toBeTruthy();
  });

  it('shows the load error with a retry instead of hiding', () => {
    const onRetry = vi.fn();
    const { getByRole, getByText } = render(
      <Harness
        workflow={undefined}
        loadError={new Error('500')}
        onRetry={onRetry}
      />,
    );
    expect(getByRole('alert').textContent).toContain('signalBoardsLoadFailed');
    fireEvent.click(getByText('signalLoadRetry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while the workflow is still loading', () => {
    const { container } = render(<Harness workflow={undefined} />);
    expect(container.textContent).toBe('');
  });
});
