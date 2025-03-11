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
    comments: [
      {
        id: '1',
        comment:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
        author: {
          avatar: 'https://github.com/shadcn.png',
          name: 'John',
          surname: 'Doe',
        },
        likes: 10,
      },
    ],
    isLoading: false,
    leadImage: 'https://github.com/shadcn.png',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Agreement Title/gi)).toBeTruthy();
  },
};
