import type { Meta, StoryObj } from '@storybook/react';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';
import { ProposalDetail } from './proposal-detail';

const meta: Meta<typeof ProposalDetail> = {
  component: ProposalDetail,
  title: 'Epics/Proposals/ProposalDetail',
};
export default meta;
type Story = StoryObj<typeof ProposalDetail>;

export const Primary: Story = {
  args: {
    creator: {
      avatar: 'https://github.com/shadcn.png',
      name: 'John',
      surname: 'Doe',
    },
    title: 'Proposal 1',
    commitment: 50,
    status: 'active',
    isLoading: false,
    content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/50%/gi)).toBeTruthy();
    expect(canvas.getByText(/75%/gi)).toBeTruthy();
  },
};
