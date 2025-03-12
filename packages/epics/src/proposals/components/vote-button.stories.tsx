import type { Meta, StoryObj } from '@storybook/react';

import { VoteButton } from './vote-button';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: VoteButton,
  title: 'Epics/Proposals/VoteButton',
} satisfies Meta<typeof VoteButton>;

export default meta;

type Story = StoryObj<typeof VoteButton>;

export const Default: Story = {
  args: {
    isLoading: false,
    isVoted: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Voted/gi)).toBeTruthy();
  },
};
