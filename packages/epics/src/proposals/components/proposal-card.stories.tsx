import type { Meta, StoryObj } from '@storybook/react';
import { ProposalCard } from './proposal-card';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<typeof ProposalCard> = {
  component: ProposalCard,
  title: 'Epics/Proposals/ProposalCard',
};
export default meta;
type Story = StoryObj<typeof ProposalCard>;

export const Primary: Story = {
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
