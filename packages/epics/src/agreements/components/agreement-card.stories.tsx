import type { Meta, StoryObj } from '@storybook/react';
import { AgreementCard } from './agreement-card';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<typeof AgreementCard> = {
  component: AgreementCard,
  title: 'Epics/Agreements/AgreementCard',
};
export default meta;
type Story = StoryObj<typeof AgreementCard>;

export const Primary: Story = {
  args: {
    commitment: 100,
    status: 'active',
    title: 'Agreement Title',
    creator: {
      avatar: 'https://github.com/shadcn.png',
      name: 'John',
      surname: 'Doe',
    },
    views: 100,
    comments: 100,
    isLoading: false,
    withoutAvatar: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Agreement Title/gi)).toBeTruthy();
  },
};
