import type { Meta, StoryObj } from '@storybook/react';

import { VotingMethodSelector } from './voting-method-selector';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: VotingMethodSelector,
  title: 'Epics/Agreements/VotingMethodSelector',
} satisfies Meta<typeof VotingMethodSelector>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/1 Member 1 Vote/gi)).toBeTruthy();
  },
};
