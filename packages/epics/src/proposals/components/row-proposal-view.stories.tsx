import type { Meta, StoryObj } from '@storybook/react';

import { RowProposalView } from './row-proposal-view';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: RowProposalView,
  title: 'Epics/Proposals/RowProposalView',
} satisfies Meta<typeof RowProposalView>;

export default meta;

type Story = StoryObj<typeof RowProposalView>;

export const Default: Story = {
  args: {
    commitment: 50,
    status: 'active',
    title: 'Proposal 1',
    leadImage: 'https://github.com/shadcn.png',
    creator: {
      name: 'John',
      surname: 'Doe',
      avatar: 'https://github.com/shadcn.png',
    },
    isLoading: false,
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Proposal 1/gi)).toBeTruthy();
  },
};
